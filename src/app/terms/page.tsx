export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted text-sm mb-10">Last updated: May 2025</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">1. Acceptance of terms</h2>
          <p className="text-muted text-sm leading-relaxed">
            By accessing or using Listly, you agree to be bound by these Terms of Service. If you
            do not agree to these terms, please do not use the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">2. Service provided as-is</h2>
          <p className="text-muted text-sm leading-relaxed">
            Listly is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either
            express or implied. We do not guarantee that the service will be uninterrupted,
            error-free, or free of bugs. Use the service at your own risk.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">3. No guarantees</h2>
          <p className="text-muted text-sm leading-relaxed">
            We make no guarantees regarding the availability, reliability, or accuracy of the
            service. We are not liable for any loss of data, missed tasks, or other damages arising
            from your use of Listly. Always maintain your own backups of critical information.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">4. User responsibility</h2>
          <p className="text-muted text-sm leading-relaxed">
            You are responsible for all activity that occurs under your account. You agree not to
            use Listly for any unlawful purpose, to harass other users, or to attempt to gain
            unauthorized access to any part of the service. You are responsible for the content
            you create and share through the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">5. Right to terminate</h2>
          <p className="text-muted text-sm leading-relaxed">
            We reserve the right to suspend or terminate your access to Listly at any time, with
            or without notice, for any reason including but not limited to violation of these
            terms. You may also stop using the service at any time and request deletion of your
            account.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">6. Changes to terms</h2>
          <p className="text-muted text-sm leading-relaxed">
            We may update these terms from time to time. Continued use of the service after
            changes constitutes acceptance of the updated terms. We will update the date at the
            top of this page when changes are made.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">7. Contact</h2>
          <p className="text-muted text-sm leading-relaxed">
            Questions about these terms? Contact us at{" "}
            <a
              href="mailto:francisco.cucullu@gmail.com"
              className="text-emerald hover:underline"
            >
              francisco.cucullu@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
