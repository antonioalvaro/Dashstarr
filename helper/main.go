// dashstarr-tailscale is a small helper that runs a Tailscale node (tsnet)
// inside Dashstarr, so the app can reach your tailnet without the
// system Tailscale app. It exposes a password protected HTTP proxy on
// 127.0.0.1 plus a PAC file that sends only tailnet addresses through it.
//
// It talks to the app with one JSON object per line: commands on stdin,
// events on stdout. When stdin closes (app quit), the helper exits.
package main

import (
	"bufio"
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"tailscale.com/client/local"
	"tailscale.com/ipn"
	"tailscale.com/ipn/ipnstate"
	"tailscale.com/tsnet"
)

type helper struct {
	ts    *tsnet.Server
	lc    *local.Client
	token string
	port  int

	outMu sync.Mutex

	mu      sync.Mutex
	state   string
	authURL string
	names   []string
	suffix  string
}

func main() {
	dir := flag.String("dir", "", "state directory")
	hostname := flag.String("hostname", "dashstarr", "device name on the tailnet")
	verbose := flag.Bool("v", false, "write tsnet logs to stderr")
	flag.Parse()

	// Kept as SB_PROXY_TOKEN for compatibility with the prebuilt helper binary.
	h := &helper{token: os.Getenv("SB_PROXY_TOKEN")}
	logf := func(string, ...any) {}
	if *verbose {
		logf = log.Printf
	}
	h.ts = &tsnet.Server{Dir: *dir, Hostname: *hostname, Logf: logf, UserLogf: logf}

	if err := h.ts.Start(); err != nil {
		h.fatal("starting tailscale: %v", err)
	}
	lc, err := h.ts.LocalClient()
	if err != nil {
		h.fatal("local client: %v", err)
	}
	h.lc = lc

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		h.fatal("proxy listen: %v", err)
	}
	h.port = ln.Addr().(*net.TCPAddr).Port
	go func() { h.fatal("proxy stopped: %v", http.Serve(ln, h.proxyHandler())) }()
	h.send(map[string]any{"type": "proxy", "port": h.port})

	wc, err := lc.WatchIPNBus(context.Background(), ipn.NotifyInitialState|ipn.NotifyRateLimit)
	if err != nil {
		h.fatal("watching tailscale: %v", err)
	}
	go h.watch(wc)
	go func() {
		for range time.Tick(15 * time.Second) {
			h.sendStatus()
		}
	}()

	sc := bufio.NewScanner(os.Stdin)
	for sc.Scan() {
		h.handle(sc.Bytes())
	}
	// The app closed our stdin: it quit or turned Tailscale off.
	h.ts.Close()
}

func (h *helper) send(v map[string]any) {
	b, _ := json.Marshal(v)
	h.outMu.Lock()
	defer h.outMu.Unlock()
	os.Stdout.Write(append(b, '\n'))
}

func (h *helper) fatal(format string, a ...any) {
	h.send(map[string]any{"type": "error", "error": fmt.Sprintf(format, a...)})
	os.Exit(1)
}

func (h *helper) dial(ctx context.Context, network, addr string) (net.Conn, error) {
	sys := h.ts.Sys()
	if sys == nil {
		return nil, fmt.Errorf("tailscale not started")
	}
	return sys.Dialer.Get().UserDial(ctx, network, addr)
}

// ---- Commands from the app ----

type command struct {
	Cmd  string `json:"cmd"`
	ID   string `json:"id"`
	Addr string `json:"addr"`
}

func (h *helper) handle(line []byte) {
	var c command
	if json.Unmarshal(line, &c) != nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	switch c.Cmd {
	case "login":
		go func() {
			defer cancel()
			if err := h.lc.StartLoginInteractive(ctx); err != nil {
				h.send(map[string]any{"type": "error", "error": "login: " + err.Error()})
			}
			h.sendStatus()
		}()
	case "logout":
		go func() {
			defer cancel()
			if err := h.lc.Logout(ctx); err != nil {
				h.send(map[string]any{"type": "error", "error": "logout: " + err.Error()})
			}
			h.mu.Lock()
			h.authURL = ""
			h.mu.Unlock()
			h.sendStatus()
		}()
	case "status":
		cancel()
		go h.sendStatus()
	case "probe":
		go func() {
			defer cancel()
			pctx, pcancel := context.WithTimeout(ctx, 4*time.Second)
			defer pcancel()
			conn, err := h.dial(pctx, "tcp", c.Addr)
			if err == nil {
				conn.Close()
			}
			h.send(map[string]any{"type": "probe", "id": c.ID, "ok": err == nil})
		}()
	default:
		cancel()
	}
}

// ---- Status ----

func (h *helper) watch(wc *local.IPNBusWatcher) {
	for {
		n, err := wc.Next()
		if err != nil {
			h.send(map[string]any{"type": "error", "error": "tailscale watcher: " + err.Error()})
			return
		}
		changed := false
		h.mu.Lock()
		if n.State != nil {
			h.state = n.State.String()
			changed = true
		}
		if n.BrowseToURL != nil {
			h.authURL = *n.BrowseToURL
			changed = true
		}
		h.mu.Unlock()
		if changed {
			h.sendStatus()
		}
	}
}

func peerInfo(p *ipnstate.PeerStatus) map[string]any {
	ip := ""
	for _, a := range p.TailscaleIPs {
		if a.Is4() {
			ip = a.String()
			break
		}
	}
	if ip == "" && len(p.TailscaleIPs) > 0 {
		ip = p.TailscaleIPs[0].String()
	}
	dns := strings.TrimSuffix(p.DNSName, ".")
	name := p.HostName
	if dns != "" {
		name = strings.SplitN(dns, ".", 2)[0]
	}
	return map[string]any{"name": name, "dnsName": dns, "ip": ip, "os": p.OS, "online": p.Online}
}

func (h *helper) sendStatus() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	st, err := h.lc.Status(ctx)
	if err != nil {
		return
	}

	h.mu.Lock()
	state := st.BackendState
	if state == "" {
		state = h.state
	}
	authURL := h.authURL
	if st.AuthURL != "" {
		authURL = st.AuthURL
	}
	if state == ipn.Running.String() {
		authURL = ""
		h.authURL = ""
	}
	h.mu.Unlock()

	out := map[string]any{"type": "status", "state": state, "authURL": authURL}
	if st.Self != nil && state == ipn.Running.String() {
		out["self"] = peerInfo(st.Self)
	}
	suffix := ""
	if st.CurrentTailnet != nil {
		out["tailnet"] = st.CurrentTailnet.Name
		suffix = strings.TrimSuffix(st.CurrentTailnet.MagicDNSSuffix, ".")
	}

	peers := []map[string]any{}
	names := []string{}
	for _, p := range st.Peer {
		pi := peerInfo(p)
		peers = append(peers, pi)
		names = append(names, strings.ToLower(pi["name"].(string)))
	}
	sort.Slice(peers, func(i, j int) bool {
		oi, oj := peers[i]["online"].(bool), peers[j]["online"].(bool)
		if oi != oj {
			return oi
		}
		return peers[i]["name"].(string) < peers[j]["name"].(string)
	})
	sort.Strings(names)
	out["peers"] = peers

	h.mu.Lock()
	h.names = names
	h.suffix = suffix
	h.mu.Unlock()
	h.send(out)
}

// ---- Proxy ----

func (h *helper) authorized(r *http.Request) bool {
	if h.token == "" {
		return true
	}
	// Username "selkies" is kept for compatibility with the prebuilt helper binary.
	want := "Basic " + base64.StdEncoding.EncodeToString([]byte("selkies:"+h.token))
	return subtle.ConstantTimeCompare([]byte(r.Header.Get("Proxy-Authorization")), []byte(want)) == 1
}

func (h *helper) servePAC(w http.ResponseWriter) {
	h.mu.Lock()
	names := map[string]bool{}
	for _, n := range h.names {
		names[n] = true
	}
	suffix := h.suffix
	h.mu.Unlock()
	nj, _ := json.Marshal(names)
	sj, _ := json.Marshal(suffix)
	w.Header().Set("Content-Type", "application/x-ns-proxy-autoconfig")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprintf(w, `var P = "PROXY 127.0.0.1:%d";
var NAMES = %s;
var SUFFIX = %s;
function FindProxyForURL(url, host) {
  host = host.toLowerCase();
  if (/^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.[0-9]+\.[0-9]+$/.test(host)) return P;
  if (/^\[?fd7a:115c:a1e0:/.test(host)) return P;
  if (dnsDomainIs(host, ".ts.net") || (SUFFIX && dnsDomainIs(host, "." + SUFFIX))) return P;
  if (NAMES[host]) return P;
  return "DIRECT";
}
`, h.port, nj, sj)
}

func (h *helper) proxyHandler() http.Handler {
	rp := &httputil.ReverseProxy{
		Director:      func(*http.Request) {}, // absolute URL from the browser is used as is
		Transport:     &http.Transport{DialContext: h.dial},
		FlushInterval: -1,
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/proxy.pac" && !r.URL.IsAbs() {
			h.servePAC(w)
			return
		}
		if !h.authorized(r) {
			w.Header().Set("Proxy-Authenticate", `Basic realm="Dashstarr Tailscale"`)
			http.Error(w, "proxy authentication required", http.StatusProxyAuthRequired)
			return
		}

		if r.Method != http.MethodConnect {
			if !r.URL.IsAbs() {
				http.Error(w, "this is a proxy; requests must use an absolute URL", http.StatusBadRequest)
				return
			}
			rp.ServeHTTP(w, r)
			return
		}

		// CONNECT tunnel (https and websockets).
		c, err := h.dial(r.Context(), "tcp", r.RequestURI)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer c.Close()
		cc, buf, err := w.(http.Hijacker).Hijack()
		if err != nil {
			return
		}
		defer cc.Close()
		io.WriteString(cc, "HTTP/1.1 200 Connection Established\r\n\r\n")

		var src io.Reader = cc
		if buf.Reader.Buffered() > 0 {
			src = buf
		}
		done := make(chan struct{}, 2)
		go func() { io.Copy(c, src); done <- struct{}{} }()
		go func() { io.Copy(cc, c); done <- struct{}{} }()
		<-done
	})
}
