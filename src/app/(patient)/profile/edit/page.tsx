import { getOwnMedicalProfileDecrypted } from "@/lib/medical";
import { ProfileForm } from "@/components/patient/profile-form";

export default async function ProfileEditPage() {
  const profile = await getOwnMedicalProfileDecrypted();

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile ? "Edit your profile" : "Create your health passport"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This is what a responder sees in an emergency. Your allergies,
          medications, and conditions are encrypted before they&apos;re stored.
        </p>
      </div>
      <ProfileForm initial={profile} />
    </div>
  );
}
