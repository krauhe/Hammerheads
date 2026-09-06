# Hammerheads · The Blue Deep

Open **index.html** in Chrome or Edge. No installation, internet connection or server is required. Keep `index.html`, `ocean.css`, `ocean.js` and `three.min.js` in the same folder.

1. **Fullscreen:** Click Fullscreen, press F or double-click the open water. Press Esc to exit fullscreen.
2. **Pause:** Press Space or click Pause. Repeat to resume the animation.
3. **Speed:** Use the slider between the buttons.
4. **Shark count:** The Sharks slider selects 0–40 hammerheads. This is the total number in the ocean; some may swim outside the field of view. The scene starts with 21.
5. **Hide controls:** Leave the pointer idle for 5 seconds. Move it or touch the screen to reveal the controls again.
   Text and sliders also fade out when a control retains focus. Keyboard input reveals them again.
6. **Push, pull and turn a shark:** Hold the left mouse button on a shark to push it deeper into the water, or the right button to pull it closer. Move the mouse to steer sideways at the same time. Near the body centre, force mainly moves the shark; at the head, tail or fins, it also rotates the body. The shark follows elastically and retains some movement and rotation after release until water resistance slows it down. One finger drags in the screen plane and can also turn the shark. These interactions work while paused, with the rest of the ocean remaining paused.
7. **Lighting time:** Choose Local clock for the current local time, or Custom time to enter any hour and minute. Time always uses 24-hour HH:mm format (00:00–23:59), regardless of browser language. You can also enter four digits, such as 2130; the field formats them as 21:30 when you leave it. Custom time holds that lighting setting until you change it. You can adjust lighting while the animation is paused.

The scene contains hammerheads on continuous swimming paths, small fish, drifting particles and sunbeams from a wavy surface above the camera. Sharks have modelled eyes, nostrils, mouths, gills and curved fins, a pale belly and fine skin texture. Light patterns move across their backs. The scene is silent and has no time limit.

Lighting follows your computer's local clock. The sun is low on the left in the morning, high at midday and low on the right in the evening. At low angles, the light turns orange-red; at night, the ocean becomes dim blue. The visual day cycle uses sunrise at 06:00, a maximum solar elevation of 65 degrees at 12:00 and sunset at 18:00. It is independent of your location and the season. Swimming speed does not affect the clock. Pause also freezes the lighting; resuming updates it to the current local time.

The surface combines ten wave components with different directions, wavelengths, phases and speeds, plus a slowly varying amplitude. The beam axes share a vanishing point that follows the sun's direction after refraction into the water. The same light controls shark illumination and the light patterns on their skin.

The sunbeam effect traces a representative point in the water back to the surface and samples that same wave field. Local slope changes deflect the shafts and vary their width and brightness, producing moving flicker and alternating focus. The shared vanishing point sets their overall direction, while individual shafts vary with the waves. This is an approximate volume effect rather than a full simulation of light transport.

Reflection uses the unpolarised Fresnel equations for water (refractive index 1.333) and air (1.00029), evaluated using the camera direction and the local wave normal. Snell's law determines refraction and the transition to total internal reflection. Reflection shows the blue underwater environment; transmitted light shows the sky. There is no fixed silver colour on the waves. Reference: [Physically Based Rendering, section 9.3](https://www.pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission). The link was checked from the local computer on 2026-09-06.

The sky, reflected underwater environment and sunbeams are simplified visual models. The surface does not trace reflections of individual sharks, and the scene does not fully simulate light scattering in water.

At night, a fixed star field appears through the refracting water surface. A broad blue fill represents combined starlight and illuminates the sharks. Its brightness is intentionally enhanced for readability rather than astronomical accuracy. Sunlight and its beams remain off at midnight.

This is a browser screensaver. It does not install itself as a Windows screensaver or desktop wallpaper. A hidden browser tab stops rendering and automatically continues when it becomes visible again. In fullscreen, the page tries to keep the screen awake if the browser allows it. With reduced motion enabled, the scene starts paused; click Resume to begin.

Models, lighting and motion were created for this scene. The 3D engine is Three.js r160; its MIT licence is included in THREE-LICENSE.

Hammerheads is open source under the GNU General Public License v3.0 (GPLv3), the same licence as T1D Simulator. Copyright © 2026 Kristian R. Harreby. The full terms are in LICENSE. Three.js retains its separate MIT licence in THREE-LICENSE.
