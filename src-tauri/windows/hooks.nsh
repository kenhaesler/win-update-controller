!macro NSIS_HOOK_PREUNINSTALL
  ; Upgrades and unattended removal preserve policy. Never infer consent to restore.
  nsExec::ExecToStack '"$INSTDIR\helper\UpdateController.Helper.exe" --uninstall-policy-state'
  Pop $0
  Pop $1
  ${If} $0 == 20
    MessageBox MB_OK|MB_ICONEXCLAMATION "An update operation is running. Wait for it to finish before removing or upgrading Update Controller." /SD IDOK
    Abort
  ${EndIf}
  ${If} $UpdateMode <> 1
    IfSilent uc_keep_policy
    ${If} $0 == 10
      MessageBox MB_YESNOCANCEL|MB_ICONQUESTION|MB_DEFBUTTON2 "Restore your previous Windows update policy before removing Update Controller?$\r$\n$\r$\nYes: restore the saved policy.$\r$\nNo: keep manual mode configured.$\r$\nCancel: keep the app installed." IDYES uc_restore_policy IDNO uc_keep_policy
      Abort
      uc_restore_policy:
        nsExec::ExecToStack '"$INSTDIR\helper\UpdateController.Helper.exe" --restore-for-uninstall'
        Pop $0
        Pop $1
        ${If} $0 != 0
          MessageBox MB_OK|MB_ICONEXCLAMATION "Policy restoration did not complete. The app will remain installed.$\r$\n$\r$\n$1"
          Abort
        ${EndIf}
    ${ElseIf} $0 != 0
      MessageBox MB_OK|MB_ICONEXCLAMATION "Unable to inspect the saved update policy. The app will remain installed. Open Settings in Update Controller to check the policy before retrying."
      Abort
    ${EndIf}
    uc_keep_policy:
  ${EndIf}
!macroend
