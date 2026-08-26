# End-to-end auth smoke test for Vanguard Sprint 1 exit criteria.
# Requires: app on :3000, Mailhog on :8025, seeded admin.
# Usage: powershell -File scripts\smoke-auth.ps1   (works on Windows PowerShell 5.1+)
param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$MailhogUrl = "http://localhost:8025",
  [string]$Identifier = "gabriel",
  [string]$Email = "gabriellelintong01@gmail.com",
  [string]$Password = "Alpenliebe3e"
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$handler = New-Object System.Net.Http.HttpClientHandler
$handler.CookieContainer = New-Object System.Net.CookieContainer
$client = New-Object System.Net.Http.HttpClient($handler)

function Invoke-Json([string]$method, [string]$path, $obj) {
  $msg = New-Object System.Net.Http.HttpRequestMessage((New-Object System.Net.Http.HttpMethod($method)), "$BaseUrl$path")
  # better-auth CSRF check requires an Origin on state-changing requests
  $msg.Headers.Add("Origin", $BaseUrl)
  if ($null -ne $obj) {
    $msg.Content = New-Object System.Net.Http.StringContent(($obj | ConvertTo-Json), [Text.Encoding]::UTF8, "application/json")
  }
  $t = $client.SendAsync($msg); $t.Wait()
  $resp = $t.Result
  $bt = $resp.Content.ReadAsStringAsync(); $bt.Wait()
  [pscustomobject]@{ Status = [int]$resp.StatusCode; Body = $bt.Result }
}

$failures = 0
function Check($name, $ok, $detail = "") {
  if ($ok) { Write-Output "PASS  $name" } else { Write-Output "FAIL  $name  $detail"; $script:failures++ }
}

# 0) baseline mailhog message count
$before = (Invoke-RestMethod "$MailhogUrl/api/v2/messages").count

# 1) username sign-in (works whether or not 2FA is already enabled)
$r1 = Invoke-Json Post "/api/auth/sign-in/username" @{ username = $Identifier; password = $Password }
Check "sign-in/username 200" ($r1.Status -eq 200) "status=$($r1.Status) body=$($r1.Body)"
$challenged = $r1.Body -match 'twoFactorRedirect"\s*:\s*true'

if (-not $challenged) {
  # 2) session exists before 2FA
  $g = Invoke-Json Get "/api/auth/get-session" $null
  $userOk = $g.Body -match '"email"' -and $g.Body -notmatch '"user":null'
  Check "get-session returns user" $userOk "body=$($g.Body)"

  # 3) enable Email OTP
  $r3 = Invoke-Json Post "/api/auth/two-factor/enable" @{ password = $Password; method = "otp" }
  Check "two-factor/enable(otp)" ($r3.Status -eq 200) "status=$($r3.Status) body=$($r3.Body)"

  # 4) sign out, sign in again -> must now be challenged
  Invoke-Json Post "/api/auth/sign-out" $null | Out-Null
  $r1 = Invoke-Json Post "/api/auth/sign-in/username" @{ username = $Identifier; password = $Password }
  $challenged = $r1.Body -match 'twoFactorRedirect"\s*:\s*true'
}
Check "2FA challenge on sign-in" $challenged "status=$($r1.Status) body=$($r1.Body)"

# 6) request OTP email
$r6 = Invoke-Json Post "/api/auth/two-factor/send-otp" @{}
Check "send-otp accepted" ($r6.Status -eq 200) "status=$($r6.Status) body=$($r6.Body)"

# 7) read newest code from Mailhog
$mh2 = Invoke-RestMethod "$MailhogUrl/api/v2/messages"
$newest = if ($mh2.count -gt 0) { $mh2.items[0] } else { $null }
$code = if ($newest -and $newest.Content.Body -match '\b(\d{6})\b') { $Matches[1] } else { $null }
Check "OTP email arrived" ($null -ne $code -and $mh2.count -gt $before) "messages=$($mh2.count) (was $before)"
Write-Output "      otp=$code"

# 8) verify OTP -> real session
if ($code) {
  $r8 = Invoke-Json Post "/api/auth/two-factor/verify-otp" @{ code = $code }
  Check "verify-otp 200" ($r8.Status -eq 200) "status=$($r8.Status) body=$($r8.Body)"

  $g2 = Invoke-Json Get "/api/auth/get-session" $null
  $authedAgain = $g2.Body -match '"email"' -and $g2.Body -notmatch '"user":null'
  Check "session after OTP" $authedAgain "body=$($g2.Body)"
}

# 9) email identifier still works as an alternative path
$r10 = Invoke-Json Post "/api/auth/sign-out" $null
$r10b = Invoke-Json Post "/api/auth/sign-in/email" @{ email = $Email; password = $Password }
$emailChallenge = $r10b.Body -match 'twoFactorRedirect"\s*:\s*true'
Check "email sign-in also challenged by 2FA" $emailChallenge "status=$($r10b.Status) body=$($r10b.Body)"

if ($failures -gt 0) { Write-Output "`nSMOKE FAILED: $failures failure(s)"; exit 1 }
Write-Output "`nSMOKE OK"
