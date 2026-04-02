import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "../theme";

interface TermsScreenProps {
  onBack: () => void;
}

export const TermsScreen = ({ onBack }: TermsScreenProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => { try { onBack(); } catch { /* no-op */ } }} style={s.backBtn} activeOpacity={0.7}>
          <View style={s.chevron} />
          <Text style={s.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={s.title}>Terms of Service</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.wordmark}>tandem</Text>
        <Text style={s.tagline}>Never Go Alone — but make sure you read this first.</Text>
        <Text style={s.meta}>Effective Date: March 1, 2025 · Last Updated: February 27, 2026</Text>
        <Text style={s.intro}>
          PLEASE READ THESE TERMS CAREFULLY. By creating an account or using Tandem, you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, do not use the Service. These Terms contain an arbitration clause and class action waiver that affect your legal rights.
        </Text>

        <Section title="1. Acceptance of Terms">
          <Body>These Terms of Service ("Terms") constitute a legally binding agreement between you and Tandem App, Inc. ("Tandem," "we," "us," or "our") governing your access to and use of the Tandem mobile application and any related services (collectively, the "Service").</Body>
          <SubHead>Eligibility</SubHead>
          <Bullet>You must be at least 18 years of age to create an account and use the Service.</Bullet>
          <Bullet>By using Tandem, you represent and warrant that you meet this age requirement and that all information you provide is accurate and complete.</Bullet>
          <Bullet>If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization to these Terms.</Bullet>
        </Section>

        <Section title="2. Description of Service">
          <SubHead>What Tandem Is</SubHead>
          <Body>Tandem is a companionship and activity-matching platform designed to connect people for shared real-world experiences. Tandem is explicitly not a dating app. Our mission is to reduce social isolation and promote connection by enabling people to find companions for activities they enjoy.</Body>
          <SubHead>What Tandem Is Not</SubHead>
          <Bullet>Tandem is not a dating service, escort service, or adult content platform.</Bullet>
          <Bullet>Tandem does not guarantee that you will find a companion for any specific activity or that any connection made through the Service will result in a real-world meetup.</Bullet>
          <Bullet>Tandem is not responsible for the conduct of users on or off the platform.</Bullet>
          <SubHead>Platform Features</SubHead>
          <Bullet>Activity posting and discovery.</Bullet>
          <Bullet>Profile creation with selfie verification.</Bullet>
          <Bullet>In-app messaging between matched users.</Bullet>
          <Bullet>Scrapbook to catalog past shared experiences.</Bullet>
          <Bullet>Map-based activity discovery.</Bullet>
          <Bullet>Membership tiers with additional features (Tandem, Tandem Go, Tandem Trail).</Bullet>
        </Section>

        <Section title="3. Account Registration and Security">
          <SubHead>Creating Your Account</SubHead>
          <Bullet>You may register using your email address, phone number, Instagram account, Spotify account, Google account, or Apple ID.</Bullet>
          <Bullet>You must provide accurate, current, and complete information during registration and keep your account information updated.</Bullet>
          <Bullet>You are responsible for maintaining the confidentiality of your login credentials.</Bullet>
          <Bullet>You are responsible for all activity that occurs under your account.</Bullet>
          <Bullet>You must notify us immediately at tandemapp.hq@gmail.com if you suspect unauthorized access to your account.</Bullet>
          <SubHead>Selfie Verification</SubHead>
          <Bullet>Tandem requires selfie verification to create an account. This process is designed to confirm that you are a real person and to promote safety on the platform.</Bullet>
          <Bullet>Submitting fraudulent verification images or impersonating another person is a violation of these Terms and may result in immediate account termination.</Bullet>
          <SubHead>One Account Per Person</SubHead>
          <Bullet>You may only maintain one active account on Tandem.</Bullet>
          <Bullet>Creating multiple accounts to circumvent a suspension or ban is prohibited.</Bullet>
        </Section>

        <Section title="4. User Conduct and Community Guidelines">
          <Body>Tandem is built on the premise of authentic, activity-first connection. By using the Service, you agree to treat all users with respect and to use the platform only for its intended purpose of finding platonic connections.</Body>
          <SubHead>Prohibited Conduct</SubHead>
          <Bullet>Using Tandem to solicit, facilitate, or engage in romantic or sexual transactions, prostitution, or escort services.</Bullet>
          <Bullet>Harassment, bullying, hate speech, or discriminatory conduct targeting any user based on race, ethnicity, religion, gender identity, sexual orientation, disability, nationality, or any other protected characteristic.</Bullet>
          <Bullet>Posting false, misleading, or fraudulent information on your profile or in activity posts.</Bullet>
          <Bullet>Impersonating any person or entity, or misrepresenting your affiliation with any person or entity.</Bullet>
          <Bullet>Using the Service to distribute spam, unsolicited commercial messages, or promotional content.</Bullet>
          <Bullet>Attempting to extract other users' personal contact information through deception.</Bullet>
          <Bullet>Using automated bots, scrapers, or scripts to access or collect data from the Service.</Bullet>
          <Bullet>Attempting to reverse engineer, decompile, or tamper with any part of the Service.</Bullet>
          <Bullet>Using the Service for any unlawful purpose or in violation of any applicable laws or regulations.</Bullet>
          <Bullet>Posting content that depicts or promotes violence, self-harm, or illegal activity.</Bullet>
          <Bullet>Uploading content that infringes any third party's intellectual property rights.</Bullet>
          <SubHead>Activity Posts</SubHead>
          <Bullet>Activity posts must describe a genuine, real-world activity you intend to participate in.</Bullet>
          <Bullet>Posts may not be used to solicit money, goods, or services from other users.</Bullet>
          <Bullet>You are responsible for the accuracy of any activity details you post, including location, date, and time.</Bullet>
          <SubHead>Reporting and Enforcement</SubHead>
          <Bullet>You can report users or content that violates these guidelines through the in-app reporting feature.</Bullet>
          <Bullet>Tandem reserves the right, but not the obligation, to review, remove, or restrict access to content or accounts that violate these Terms.</Bullet>
          <Bullet>Violations may result in warnings, temporary suspension, or permanent termination of your account, at our sole discretion.</Bullet>
        </Section>

        <Section title="5. Safety">
          <Body>Tandem takes safety seriously, but we cannot guarantee the conduct of any user. When meeting someone in person through Tandem, please take reasonable precautions.</Body>
          <SubHead>Safety Tips</SubHead>
          <Bullet>Always meet in a public place for your first Tandem.</Bullet>
          <Bullet>Tell a friend or family member where you are going and who you are meeting.</Bullet>
          <Bullet>Do not share your home address, financial information, or other sensitive personal data with other users.</Bullet>
          <Bullet>Trust your instincts. If something feels wrong, leave.</Bullet>
          <Bullet>Contact local emergency services if you are ever in immediate danger.</Bullet>
          <SubHead>Background Checks</SubHead>
          <Bullet>Tandem does not conduct criminal background checks on users. Selfie verification confirms identity but does not verify criminal history.</Bullet>
          <Bullet>The absence of a background check does not imply any endorsement, certification, or guarantee regarding any user's character or conduct.</Bullet>
        </Section>

        <Section title="6. Membership Tiers and Payments">
          <SubHead>Membership Plans</SubHead>
          <Body>Tandem offers three membership tiers: Tandem (free), Tandem Go (paid), and Tandem Trail (paid). Features available at each tier are described in the app and subject to change with notice.</Body>
          <SubHead>Billing and Auto-Renewal</SubHead>
          <Bullet>Paid memberships are billed in advance on a recurring basis (weekly, monthly, or multi-month, depending on your selected plan).</Bullet>
          <Bullet>Your subscription will automatically renew at the end of each billing period unless you cancel before the renewal date.</Bullet>
          <Bullet>Prices displayed show the per-week cost for your convenience; the full billing period amount is charged upfront.</Bullet>
          <Bullet>All payments are processed by Stripe. By purchasing a membership, you agree to Stripe's terms of service.</Bullet>
          <SubHead>Cancellation</SubHead>
          <Bullet>You may cancel your subscription at any time through the app's Settings or through the App Store / Google Play subscription management tools.</Bullet>
          <Bullet>Cancellation takes effect at the end of the current billing period. You will retain access to paid features until then.</Bullet>
          <Bullet>Tandem does not offer refunds for partial billing periods, except as required by applicable law.</Bullet>
          <SubHead>Refund Policy</SubHead>
          <Bullet>If you experience a technical error that prevents you from accessing paid features, please contact tandemapp.hq@gmail.com and we will investigate and issue a credit or refund as appropriate.</Bullet>
          <Bullet>Refund eligibility for App Store purchases is governed by Apple's refund policy. Refund eligibility for Google Play purchases is governed by Google's refund policy.</Bullet>
          <Bullet>We reserve the right to refuse refunds for accounts terminated due to violations of these Terms.</Bullet>
          <SubHead>Price Changes</SubHead>
          <Body>We may change subscription prices at any time. We will provide at least 30 days' notice before any price change takes effect for existing subscribers.</Body>
        </Section>

        <Section title="7. Intellectual Property">
          <SubHead>Tandem's Property</SubHead>
          <Body>The Tandem name, logo, brand, app design, features, and content created by Tandem (including the "Tandem'd" concept, "Never Go Alone" tagline, and all associated branding) are owned by Tandem App, Inc. and protected by applicable intellectual property laws. You may not use our trademarks or branding without our prior written consent.</Body>
          <SubHead>Your Content</SubHead>
          <Bullet>You retain ownership of content you create and post on Tandem, including profile photos, activity posts, and scrapbook entries.</Bullet>
          <Bullet>By posting content on Tandem, you grant us a non-exclusive, worldwide, royalty-free, sublicensable license to use, reproduce, display, and distribute your content solely for the purpose of operating and improving the Service.</Bullet>
          <Bullet>This license ends when you delete your content or close your account, subject to any prior sharing of your content with other users.</Bullet>
          <Bullet>You represent and warrant that you own or have the necessary rights to post any content you submit, and that your content does not infringe any third party's rights.</Bullet>
          <SubHead>Feedback</SubHead>
          <Body>If you submit ideas, suggestions, or feedback about the Service, you grant Tandem a perpetual, irrevocable, royalty-free right to use that feedback without any obligation to you.</Body>
        </Section>

        <Section title="8. Third-Party Services">
          <Bullet>Tandem integrates with third-party services including Stripe (payments), Apple Sign-In, Google Sign-In, and optional social media account linking. Your use of these services is governed by the respective third party's terms and privacy policies.</Bullet>
          <Bullet>Tandem is not responsible for the availability, accuracy, or practices of any third-party service.</Bullet>
        </Section>

        <Section title="9. Disclaimers and Limitation of Liability">
          <SubHead>No Warranty</SubHead>
          <Body>The Service is provided "as is" and "as available" without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement. Tandem does not warrant that the Service will be uninterrupted, error-free, or free of harmful components.</Body>
          <SubHead>Limitation of Liability</SubHead>
          <Body>To the fullest extent permitted by applicable law, Tandem, its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, goodwill, or data, arising out of or related to your use of the Service or any real-world interactions with other users. Tandem's total liability to you for any claim shall not exceed the greater of (a) the amount you paid to Tandem in the 12 months preceding the claim or (b) $100.</Body>
          <SubHead>User Interactions</SubHead>
          <Bullet>Tandem is not a party to any interaction between users on or off the platform.</Bullet>
          <Bullet>Tandem is not liable for any harm resulting from in-person meetings arranged through the Service.</Bullet>
          <Bullet>You assume all risk associated with meeting other users in person.</Bullet>
        </Section>

        <Section title="10. Indemnification">
          <Body>You agree to indemnify, defend, and hold harmless Tandem App, Inc. and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third party's rights; or (d) your conduct in connection with the Service, including any real-world interactions with other users.</Body>
        </Section>

        <Section title="11. Dispute Resolution and Arbitration">
          <SubHead>Informal Resolution First</SubHead>
          <Body>Before initiating any formal dispute, you agree to contact us at tandemapp.hq@gmail.com and give us 30 days to resolve the issue informally.</Body>
          <SubHead>Binding Arbitration</SubHead>
          <Bullet>If we cannot resolve the dispute informally, you and Tandem agree to resolve any dispute through binding individual arbitration administered by JAMS under its applicable rules, rather than in court.</Bullet>
          <Bullet>The arbitration will take place in the county where you reside or, at your election, via telephone or video conference.</Bullet>
          <Bullet>The arbitrator's decision will be final and binding and may be entered as a judgment in any court of competent jurisdiction.</Bullet>
          <SubHead>Class Action Waiver</SubHead>
          <Body>You and Tandem agree that each may only bring claims against the other in an individual capacity and not as a plaintiff or class member in any purported class or representative action.</Body>
          <SubHead>Exceptions</SubHead>
          <Bullet>Either party may seek emergency injunctive relief in court to prevent irreparable harm pending arbitration.</Bullet>
          <Bullet>Claims related to intellectual property infringement may be brought in court.</Bullet>
          <Bullet>If the class action waiver is found unenforceable, the entire arbitration provision will be void.</Bullet>
          <SubHead>Governing Law</SubHead>
          <Body>These Terms are governed by the laws of the State of Delaware, without regard to its conflict of law principles.</Body>
        </Section>

        <Section title="12. Account Termination">
          <SubHead>Your Right to Close Your Account</SubHead>
          <Body>You may close your account at any time through Settings. Upon closure, your profile will be removed from the platform within 30 days.</Body>
          <SubHead>Our Right to Terminate</SubHead>
          <Bullet>Tandem reserves the right to suspend or permanently terminate your account at any time for any reason, including violations of these Terms, conduct we deem harmful to the community, or inactivity.</Bullet>
          <Bullet>We will make reasonable efforts to notify you of a termination unless prohibited by law or if notifying you would compromise the safety of another user.</Bullet>
          <Bullet>Upon termination, your right to use the Service ceases immediately. Active paid memberships will not be refunded upon termination for cause.</Bullet>
        </Section>

        <Section title="13. Modifications to the Service and Terms">
          <SubHead>Changes to the Service</SubHead>
          <Bullet>Tandem may modify, suspend, or discontinue any aspect of the Service at any time, with or without notice.</Bullet>
          <Bullet>We are not liable to you or any third party for any modification, suspension, or discontinuation of the Service.</Bullet>
          <SubHead>Changes to These Terms</SubHead>
          <Bullet>We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms in the app and, where appropriate, by email or push notification.</Bullet>
          <Bullet>Your continued use of the Service after the effective date of any changes constitutes your acceptance of the revised Terms.</Bullet>
          <Bullet>If you do not agree to the updated Terms, you must stop using the Service and close your account.</Bullet>
        </Section>

        <Section title="14. General Provisions">
          <SubHead>Entire Agreement</SubHead>
          <Body>These Terms, together with our Privacy Policy, constitute the entire agreement between you and Tandem regarding the Service.</Body>
          <SubHead>Severability</SubHead>
          <Body>If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.</Body>
          <SubHead>No Waiver</SubHead>
          <Body>Our failure to enforce any provision of these Terms does not constitute a waiver of our right to enforce it in the future.</Body>
          <SubHead>Assignment</SubHead>
          <Body>You may not assign your rights or obligations under these Terms without our prior written consent. Tandem may assign these Terms in connection with a merger, acquisition, or sale of assets.</Body>
          <SubHead>Contact Us</SubHead>
          <Body>For questions about these Terms, please contact us at tandemapp.hq@gmail.com.</Body>
        </Section>

        <View style={s.footer}>
          <Text style={s.footerText}>Tandem App, Inc.</Text>
          <Text style={s.footerText}>tandemapp.hq@gmail.com · www.thetandemweb.com</Text>
          <Text style={s.footerText}>© 2026 Tandem App, Inc. All rights reserved.</Text>
          <Text style={s.footerBrand}>Never Go Alone</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={s.section}>
    <Text style={s.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const SubHead = ({ children }: { children: string }) => (
  <Text style={s.subHead}>{children}</Text>
);

const Body = ({ children }: { children: string }) => (
  <Text style={s.body}>{children}</Text>
);

const Bullet = ({ children }: { children: string }) => (
  <View style={s.bulletRow}>
    <Text style={s.bulletDot}>·</Text>
    <Text style={s.bulletText}>{children}</Text>
  </View>
);

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: "rgba(249,246,242,0.97)",
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 6, width: 80 },
  chevron: { width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: colors.teal, transform: [{ rotate: "45deg" }] },
  backText: { fontSize: 14, fontWeight: "600", color: colors.teal },
  title: { fontSize: 17, fontWeight: "700", color: colors.foreground, letterSpacing: -0.3 },

  content: { paddingHorizontal: 20, paddingTop: 24, gap: 8 },

  wordmark: { fontSize: 28, fontWeight: "800", color: colors.teal, letterSpacing: -0.8 },
  tagline: { fontSize: 15, fontWeight: "600", color: colors.foreground, marginTop: 2 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 4 },
  intro: { fontSize: 13, color: colors.foreground, lineHeight: 21, marginBottom: 8 },

  section: { gap: 8, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground, marginTop: 8 },
  subHead: { fontSize: 13, fontWeight: "700", color: colors.teal, marginTop: 4 },
  body: { fontSize: 13, color: colors.muted, lineHeight: 21 },
  bulletRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bulletDot: { fontSize: 15, color: colors.teal, lineHeight: 21, marginTop: -1 },
  bulletText: { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 21 },

  footer: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border, gap: 4, alignItems: "center" },
  footerText: { fontSize: 12, color: colors.muted, textAlign: "center" },
  footerBrand: { fontSize: 13, fontWeight: "700", color: colors.teal, marginTop: 4 },
});
