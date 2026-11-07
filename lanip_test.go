package main

import (
	"net"
	"testing"
)

func ipnet(s string) net.Addr {
	ip, n, err := net.ParseCIDR(s)
	if err != nil {
		panic(err)
	}
	n.IP = ip
	return n
}

func TestPickPrefersWiFiOverVPN(t *testing.T) {
	best, all := pickLANIP([]ifaceAddrs{
		{"utun4", []net.Addr{ipnet("10.8.0.3/24")}},
		{"en0", []net.Addr{ipnet("192.168.1.23/24")}},
	})
	if !best.Equal(net.ParseIP("192.168.1.23")) {
		t.Fatalf("best = %v", best)
	}
	if len(all) != 2 || !all[0].Equal(best) || !all[1].Equal(net.ParseIP("10.8.0.3")) {
		t.Fatalf("all = %v", all)
	}
}

func TestPickSkipsLinkLocalAndIPv6(t *testing.T) {
	best, all := pickLANIP([]ifaceAddrs{
		{"en0", []net.Addr{ipnet("169.254.3.4/16"), ipnet("fe80::1/64")}},
		{"bridge100", []net.Addr{ipnet("192.168.2.1/24")}},
	})
	if !best.Equal(net.ParseIP("192.168.2.1")) || len(all) != 1 {
		t.Fatalf("best = %v, all = %v", best, all)
	}
}

func TestPickNone(t *testing.T) {
	best, all := pickLANIP([]ifaceAddrs{{"lo0", []net.Addr{ipnet("127.0.0.1/8")}}})
	if best != nil || len(all) != 0 {
		t.Fatalf("best = %v, all = %v", best, all)
	}
}

func TestPickPublicOnWiFiBeforeVPN(t *testing.T) {
	best, _ := pickLANIP([]ifaceAddrs{
		{"utun2", []net.Addr{ipnet("10.0.0.5/24")}},
		{"eth1", []net.Addr{ipnet("172.16.0.9/16")}},
		{"en5", []net.Addr{ipnet("100.64.1.2/10")}},
	})
	if !best.Equal(net.ParseIP("172.16.0.9")) {
		t.Fatalf("best = %v", best)
	}
}
