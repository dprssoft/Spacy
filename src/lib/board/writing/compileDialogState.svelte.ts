/** Open state of the compile dialog (one board at a time). */
class CompileDialogState {
	open = $state(false);
}
export const compileDialog = new CompileDialogState();
