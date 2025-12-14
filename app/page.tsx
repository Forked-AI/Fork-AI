/**
 * PRELAUNCH REDIRECT
 * This page temporarily redirects to /prelaunch during the prelaunch phase.
 * The full landing page with all sections is available at /landing (with sections masked).
 * 
 * SEE: PRELAUNCH-RESTORATION.md for restoration instructions when ready to launch.
 */

import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to prelaunch page during prelaunch phase
  redirect("/prelaunch");
}
