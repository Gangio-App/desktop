; Gangio Desktop Custom Installer Script
; Created by Gangio Team

!macro customHeader
  !system "echo '' > ${BUILD_RESOURCES_DIR}/customHeader"
!macroend

!macro customInstall
  ; Add custom installation steps here
  
  ; Create URL shortcut to Gangio website
  WriteIniStr "$INSTDIR\Gangio Website.url" "InternetShortcut" "URL" "https://gangio.vercel.app"
  CreateShortCut "$DESKTOP\Gangio Website.lnk" "$INSTDIR\Gangio Website.url" "" "$INSTDIR\resources\icons\icon.ico"
  
  ; Create Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\Gangio"
  CreateShortCut "$SMPROGRAMS\Gangio\Gangio Desktop.lnk" "$INSTDIR\Gangio Desktop.exe" "" "$INSTDIR\resources\icons\icon.ico"
  CreateShortCut "$SMPROGRAMS\Gangio\Gangio Website.lnk" "$INSTDIR\Gangio Website.url" "" "$INSTDIR\resources\icons\icon.ico"
  
  ; Add application to Windows Firewall exceptions
  ExecWait 'netsh advfirewall firewall add rule name="Gangio Desktop" dir=in action=allow program="$INSTDIR\Gangio Desktop.exe" enable=yes profile=any'
!macroend

!macro customUnInstall
  ; Add custom uninstallation steps here
  
  ; Remove desktop shortcuts
  Delete "$DESKTOP\Gangio Website.lnk"
  
  ; Remove Start Menu shortcuts
  Delete "$SMPROGRAMS\Gangio\Gangio Desktop.lnk"
  Delete "$SMPROGRAMS\Gangio\Gangio Website.lnk"
  RMDir "$SMPROGRAMS\Gangio"
  
  ; Remove URL shortcut
  Delete "$INSTDIR\Gangio Website.url"
  
  ; Remove firewall rule
  ExecWait 'netsh advfirewall firewall delete rule name="Gangio Desktop"'
!macroend
