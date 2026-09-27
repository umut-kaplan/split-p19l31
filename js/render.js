/* Ansichten rufen render() auf, ohne app.js zu importieren. So entsteht kein Import-Kreis. */
let renderFn = () => {};
export const setRender = fn => { renderFn = fn; };
export const render = () => renderFn();
