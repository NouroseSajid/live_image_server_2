$folderIdPath = "app\api\images\[folderId]"
Write-Host "Deleting: $folderIdPath"
Remove-Item -LiteralPath $folderIdPath -Recurse -Force
Write-Host "Deleted successfully"
Get-ChildItem "app\api\images" | ForEach-Object { Write-Host "- $($_.Name)" }
