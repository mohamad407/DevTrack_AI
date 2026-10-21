import LegalLayout, { LegalSection } from '../components/legal/LegalLayout.jsx';

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="21 October 2026">
      <LegalSection title="1. Acceptance">
        <p>By creating an account or using DevTrack AI, you agree to these Terms. If you use DevTrack AI for an organization, you confirm you are allowed to accept these Terms on its behalf.</p>
      </LegalSection>

      <LegalSection title="2. Your account">
        <p>You must provide accurate information, verify your email address, and keep your login credentials confidential. You are responsible for activity under your account.</p>
      </LegalSection>

      <LegalSection title="3. Acceptable use">
        <p>You agree not to misuse the service. This includes attempting to access data you are not allowed to see, interfering with the platform, uploading malicious code, or using DevTrack AI to break the law or harm others.</p>
      </LegalSection>

      <LegalSection title="4. Your content">
        <p>You keep ownership of the projects, stories, and other content you create. You give us permission to store and process that content only as needed to provide DevTrack AI to you and your team.</p>
      </LegalSection>

      <LegalSection title="5. Reviews">
        <p>Reviews you post may be shown publicly on our website. Post only honest feedback and do not include personal data of others, offensive content, or spam. We may remove reviews that break these rules.</p>
      </LegalSection>

      <LegalSection title="6. AI features">
        <p>AI-generated suggestions can be inaccurate. Review them before relying on them, especially for production decisions.</p>
      </LegalSection>

      <LegalSection title="7. Fees">
        <p>DevTrack AI is currently free to use. If paid plans are introduced in the future, pricing will be shown clearly before you are charged.</p>
      </LegalSection>

      <LegalSection title="8. Termination">
        <p>You can stop using DevTrack AI at any time. We may suspend or end accounts that violate these Terms.</p>
      </LegalSection>

      <LegalSection title="9. Disclaimers and liability">
        <p>DevTrack AI is provided "as is". To the fullest extent the law allows, we are not liable for indirect or consequential losses arising from your use of the service.</p>
      </LegalSection>

      <LegalSection title="10. Changes and governing law">
        <p>We may update these Terms and will show the new date above. These Terms are governed by the laws of the State of Tamil Nadu, India. Contact us at asihf174@gmail.com with questions.</p>
      </LegalSection>
    </LegalLayout>
  );
}
