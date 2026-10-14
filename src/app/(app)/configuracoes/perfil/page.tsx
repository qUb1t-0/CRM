import type { Metadata } from "next";
import { AvatarUpload } from "@/components/avatar-upload";
import { ProfileForm } from "@/components/profile-form";
import { Card } from "@/components/ui";
import { getContext } from "@/lib/session";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const { user, profile } = await getContext();
  return (
    <Card className="max-w-4xl px-5">
      <div className="border-b border-line py-4">
        <h2 className="text-base font-semibold">Meu perfil</h2>
        <p className="mt-0.5 text-sm text-muted">Essas informações aparecem para a sua equipe no CRM.</p>
      </div>
      <ProfileForm
        values={{
          name: profile.name,
          email: profile.email,
          pendingEmail: profile.pendingEmail,
          jobTitle: profile.jobTitle,
          phone: profile.phone,
          birthDate: profile.birthDate,
          bio: profile.bio,
        }}
        avatar={<AvatarUpload userId={user.id} name={profile.name} url={profile.avatarUrl} />}
      />
    </Card>
  );
}
