document.getElementById('enter-ar').addEventListener('click', async () => {
  if (navigator.xr) {
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local', 'dom-overlay'],
        domOverlay: { root: document.body }
      });

      const glCanvas = document.createElement('canvas');
      document.body.appendChild(glCanvas);
      const gl = glCanvas.getContext('webgl', { xrCompatible: true });

      const xrRefSpace = await session.requestReferenceSpace('local');
      const xrLayer = new XRWebGLLayer(session, gl);
      session.updateRenderState({ baseLayer: xrLayer });

      session.requestAnimationFrame((time, frame) => {
        const pose = frame.getViewerPose(xrRefSpace);
        if (pose) {
          // Render loop logic here
        }
      });
    } catch (err) {
      console.error('Failed to start AR session:', err);
    }
  } else {
    alert('WebXR not supported');
  }
});
