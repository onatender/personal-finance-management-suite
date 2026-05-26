$files = Get-ChildItem -Recurse -Filter "*.gradle" -Path "android"
foreach ($file in $files) {
    $content = Get-Content $file.FullName
    if ($content -match "VERSION_21") {
        Write-Host "Fixing Java 21 -> 17 in $($file.FullName)"
        $content = $content -replace "VERSION_21", "VERSION_17"
        Set-Content $file.FullName $content
    }
}
