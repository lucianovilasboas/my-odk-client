/**
 * Entrada do harness de navegador. O motor XForms oficial depende de DOM e do
 * bundle Emscripten do parser XPath, então o gate ENGINE roda em Chromium, não
 * em Node.
 */
import { createInstance, loadForm, restoreInstance } from '@getodk/xforms-engine';

window.OdkEngine = {
  createInstance,
  loadForm,
  restoreInstance,
};
