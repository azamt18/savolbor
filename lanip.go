package main

import (
	"cmp"
	"net"
	"slices"
	"strings"
)

type ifaceAddrs struct {
	Name  string
	Addrs []net.Addr
}

// pickLANIP chooses the address phones should use to reach this laptop:
// private ipv4 on wi-fi/ethernet/hotspot bridges first, vpn tunnels last.
// all lists every usable address in rank order.
func pickLANIP(ifaces []ifaceAddrs) (best net.IP, all []net.IP) {
	type cand struct {
		ip   net.IP
		rank int
	}
	var cands []cand
	for _, ifc := range ifaces {
		for _, a := range ifc.Addrs {
			ipn, ok := a.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipn.IP.To4()
			if ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
				continue
			}
			cands = append(cands, cand{ip, rankIP(ifc.Name, ip)})
		}
	}
	slices.SortStableFunc(cands, func(a, b cand) int { return cmp.Compare(a.rank, b.rank) })
	for _, c := range cands {
		all = append(all, c.ip)
	}
	if len(all) > 0 {
		best = all[0]
	}
	return best, all
}

func rankIP(iface string, ip net.IP) int {
	hasPrefix := func(prefixes ...string) bool {
		for _, p := range prefixes {
			if strings.HasPrefix(iface, p) {
				return true
			}
		}
		return false
	}
	switch {
	case hasPrefix("utun", "tun", "ppp"):
		return 3
	case ip.IsPrivate() && hasPrefix("en", "wl", "eth", "bridge"):
		return 0
	case ip.IsPrivate():
		return 1
	default:
		return 2
	}
}

// lanInterfaces lists the addresses of every interface that is up and not loopback.
func lanInterfaces() []ifaceAddrs {
	ifs, err := net.Interfaces()
	if err != nil {
		return nil
	}
	var out []ifaceAddrs
	for _, ifc := range ifs {
		if ifc.Flags&net.FlagUp == 0 || ifc.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := ifc.Addrs()
		if err != nil {
			continue
		}
		out = append(out, ifaceAddrs{ifc.Name, addrs})
	}
	return out
}

// ifaceOf returns the interface name that owns ip, for the startup banner.
func ifaceOf(ifaces []ifaceAddrs, ip net.IP) string {
	for _, ifc := range ifaces {
		for _, a := range ifc.Addrs {
			if ipn, ok := a.(*net.IPNet); ok && ipn.IP.Equal(ip) {
				return ifc.Name
			}
		}
	}
	return "?"
}
