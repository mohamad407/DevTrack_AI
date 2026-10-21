import LegalLayout, { LegalSection } from '../components/legal/LegalLayout.jsx';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="21 October 2026">
      <LegalSection title="1. Who we are">
        <p>DevTrack AI is operated by DevTrack AI ("we", "us"). You can contact us at asihfibrahim600@gmail.com.</p>
      </LegalSection>

      <LegalSection title="2. Information we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li><span className="text-ink-100">Account details:</span> your name, email address, and profile information you provide.</li>
          <li><span className="text-ink-100">Project content:</span> projects, stories, tasks, sprints, comments, and files you create.</li>
          <li><span className="text-ink-100">Reviews:</span> the star rating, comment, and display name you submit.</li>
          <li><span className="text-ink-100">Technical data:</span> browser type, device information, IP address, and usage events needed to run and secure the service.</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use your information">
        <p>We use your information to provide and improve DevTrack AI, authenticate you, send verification and notification emails, provide AI-assisted features you choose to use, keep the service secure, and respond to support requests.</p>
      </LegalSection>

      <LegalSection title="4. Service providers">
        <p>We share data only with providers that help us run DevTrack AI, including authentication, database hosting, hosting and delivery, and Google (Gemini) for the AI features. These providers process data on our instructions and under their own confidentiality obligations.</p>
      </LegalSection>

      <LegalSection title="5. Cookies and local storage">
        <p>We use essential cookies and local storage to keep you signed in and remember preferences such as dismissed announcements. We do not use advertising trackers.</p>
      </LegalSection>

      <LegalSection title="6. Data retention">
        <p>We keep account and project data while your account is active. You can ask us to delete your account, and we will remove your personal data within 30 days, except where we must keep it for legal reasons.</p>
      </LegalSection>

      <LegalSection title="7. Your rights">
        <p>Depending on where you live, you may have the right to access, correct, export, or delete your personal data, and to object to or restrict some processing. To exercise these rights, email asihfibrahim600@gmail.com.</p>
      </LegalSection>

      <LegalSection title="8. Security">
        <p>We use encryption in transit, access controls, and rate limiting to protect your data. No system is perfectly secure, so please use a strong password and keep it private.</p>
      </LegalSection>

      <LegalSection title="9. Changes to this policy">
        <p>We may update this policy from time to time. We will show the new date above and, for significant changes, notify you in the app.</p>
      </LegalSection>
    </LegalLayout>
  );
}
