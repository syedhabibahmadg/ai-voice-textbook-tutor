# Trusted private LAN only

Keep the laptop and phones on the same trusted Wi-Fi. Run `ipconfig` and select the Wi-Fi IPv4 address, not a Hyper-V/VPN adapter. The launcher prints gateway-backed addresses. Open `http://LAPTOP_IP:8000/health` from the phone browser first.

Inspect the network profile:

```powershell
Get-NetConnectionProfile
```

Only for your trusted home/private Wi-Fi, in an elevated PowerShell, substitute the correct interface name:

```powershell
Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
New-NetFirewallRule -DisplayName "Textbook Tutor Private LAN" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -Profile Private -RemoteAddress LocalSubnet
```

Do not change a public/untrusted network to Private. Do not disable Windows Firewall. Remove the rule later with `Remove-NetFirewallRule -DisplayName "Textbook Tutor Private LAN"`.

- Refused: start the launcher and check another process is not occupying port 8000.
- Timeout: verify current IP, firewall profile, same subnet, VPN routing and router guest/client isolation.
- Invalid JSON: the address may point at another service; test `/health`.
- HTTP errors: inspect server logs and selected textbook/chapter; unindexed books show Not ready.
- Offline: questions stay editable; reconnect from Settings and retry. IP changes are saved per phone.

The LAN preview APK permits cleartext because arbitrary private IPs cannot be enumerated in Android domain rules. Its client restricts HTTP to private IPv4/localhost addresses. Production config disables cleartext; use HTTPS. Do not port-forward this unauthenticated prototype to the internet. Later remote access should use a private VPN or authenticated HTTPS reverse proxy with TLS, rate limits and access control; a public tunnel alone is not production security.
