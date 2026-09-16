import { redirect } from "next/navigation";

export default function VerifyIndexPage() {
  // Redirect the base /verify path to the repository, 
  // where verifiers can select which record to verify.
  redirect("/repository");
}
