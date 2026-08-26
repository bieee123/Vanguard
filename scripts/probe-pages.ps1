param([string]$BaseUrl = "http://localhost:3000")
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Net.Http

$handler = New-Object System.Net.Http.HttpClientHandler
$handler.CookieContainer = New-Object System.Net.CookieContainer
$client = New-Object System.Net.Http.HttpClient($handler)

function Invoke-Json([string]$method, [string]$path, $obj) {
  $msg = New-Object System.Net.Http.HttpRequestMessage((New-Object System.Net.Http.HttpMethod($method)), "$BaseUrl$path")
  $msg.Headers.Add("Origin", $BaseUrl)
  if ($null -ne $obj) {
    $msg.Content = New-Object System.Net.Http.StringContent(($obj | ConvertTo-Json), [Text.Encoding]::UTF8, "application/json")
  }
  $t = $client.SendAsync($msg); $t.Wait()
  $resp = $t.Result
  $bt = $resp.Content.ReadAsStringAsync(); $bt.Wait()
  [pscustomobject]@{ Status = [int]$resp.StatusCode; Body = $bt.Result }
}

$si = Invoke-Json Post "/api/auth/sign-in/username" @{ username = "gabriel"; password = "Alpenliebe3e" }
if ($si.Body -match 'twoFactorRedirect') {
  Invoke-Json Post "/api/auth/two-factor/send-otp" @{} | Out-Null
  Start-Sleep -Seconds 1
  $mh = Invoke-RestMethod "http://localhost:8025/api/v2/messages"
  $code = $null
  if ($mh.count -gt 0 -and $mh.items[0].Content.Body -match '\b(\d{6})\b') { $code = $Matches[1] }
  Invoke-Json Post "/api/auth/two-factor/verify-otp" @{ code = $code } | Out-Null
}

foreach ($path in @("/timeline", "/kb/new", "/reports", "/settings/account", "/settings/users", "/engagements")) {
  # resolve a real report id for /reports/[id]
  if ($path -eq "/reports") {
    $list = Invoke-Json Get "/api/auth/get-session" $null
  }
  $t = $client.GetAsync("$BaseUrl$path"); $t.Wait()
  $r = $t.Result
  $bt = $r.Content.ReadAsStringAsync(); $bt.Wait()
  $err = if ($bt.Result -match 'Something broke') { "  <-- BROKE" } else { "" }
  Write-Output ("GET {0} -> {1} len={2}{3}" -f $path, [int]$r.StatusCode, $bt.Result.Length, $err)
}
