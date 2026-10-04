!macro NSIS_HOOK_PREUNINSTALL
  ; Test-app removal retains shared Windows policy and driver/activity state.
  nsExec::ExecToStack '"$INSTDIR\helper\UpdateController.Helper.exe" --uninstall-policy-state'
  Pop $0
  Pop $1
  ${If} $0 == 20
    MessageBox MB_OK|MB_ICONEXCLAMATION "An update operation is running. Wait for it to finish before removing or upgrading Update Controller Test." /SD IDOK
    Abort
  ${EndIf}
!macroend
