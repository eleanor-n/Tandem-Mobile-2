import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "../theme";

interface PrivacyScreenProps {
  onBack: () => void;
}

export const PrivacyScreen = ({ onBack }: PrivacyScreenProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => { try { onBack(); } catch { /* no-op */ } }} style={s.backBtn} activeOpacity={0.7}>
          <View style={s.chevron} />
          <Text style={s.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={s.title}>Privacy Policy</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: 60 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.wordmark}>tandem</Text>
        <Text style={s.tagline}>Never Go Alone — but your data stays yours.</Text>
        <Text style={s.intro}>
          Welcome to Tandem ("we," "us," or "our"). Tandem is a companionship app designed to connect people for shared activities — not dating, not networking, just genuine human connection. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services (collectively, the "Service"). Please read this policy carefully. By using Tandem, you agree to the practices described here.
        </Text>

        <Section title="1. Information We Collect">
          <SubHead>Information You Provide Directly</SubHead>
          <Bullet>Account registration details: name, email address, phone number, date of birth, and password.</Bullet>
          <Bullet>Profile information: profile photos, gender identity, sexual orientation, relationship status, occupation, personality type, humor type, religion, and the preferences you set for who you'd like to connect with.</Bullet>
          <Bullet>Activity posts: descriptions, locations, dates, and times of activities you post on the platform.</Bullet>
          <Bullet>Personality prompts and responses you choose to share on your profile.</Bullet>
          <Bullet>Communications you send through the in-app chat feature.</Bullet>
          <Bullet>Payment information processed securely through our third-party payment processor (Stripe). We do not store your full payment card details on our servers.</Bullet>
          <Bullet>Feedback, support requests, or other correspondence you send to us.</Bullet>
          <SubHead>Information We Collect Automatically</SubHead>
          <Bullet>Device information: device type, operating system, unique device identifiers, and mobile network information.</Bullet>
          <Bullet>Usage data: features you use, pages you visit, actions you take, and the time, frequency, and duration of your activities.</Bullet>
          <Bullet>Location information: with your permission, we collect precise GPS location to enable map-based features and activity discovery. You may disable location access through your device settings.</Bullet>
          <Bullet>Log data: IP addresses, browser type, referring/exit pages, and timestamps.</Bullet>
          <Bullet>Cookies and similar tracking technologies used to remember your preferences and improve your experience.</Bullet>
          <SubHead>Information From Third Parties</SubHead>
          <Bullet>If you choose to sign in via Google or Apple ID, we receive basic profile information (name and email) as permitted by those platforms.</Bullet>
          <Bullet>If you optionally link social media accounts, we may receive information you authorize from those platforms.</Bullet>
          <Bullet>If you connect your Google account for verification, we use this to confirm your identity and mark your profile as verified.</Bullet>
        </Section>

        <Section title="2. How We Use Your Information">
          <SubHead>Core Service Delivery</SubHead>
          <Bullet>To create and manage your account.</Bullet>
          <Bullet>To power our activity-matching algorithm and surface relevant activity posts and potential Tandems based on your preferences, location, past activity, and compatibility.</Bullet>
          <Bullet>To enable the in-app chat feature between matched users.</Bullet>
          <Bullet>To display your profile to other users in accordance with your preference settings.</Bullet>
          <Bullet>To process payments and manage your membership tier.</Bullet>
          <Bullet>To send you notifications about mutual matches ("You've been Tandem'd!"), upcoming activities, and users from your contacts who join the platform (with your permission).</Bullet>
          <SubHead>Safety and Trust</SubHead>
          <Bullet>To verify your identity through social account verification and reduce fake accounts.</Bullet>
          <Bullet>To enforce our Terms of Service and Community Guidelines.</Bullet>
          <Bullet>To investigate and prevent fraudulent, harmful, or illegal activity.</Bullet>
          <SubHead>Product Improvement</SubHead>
          <Bullet>To analyze usage patterns and improve our matching algorithm, focusing on optimizing for completed real-world meetups rather than in-app engagement metrics.</Bullet>
          <Bullet>To conduct A/B testing to improve the onboarding experience and app features.</Bullet>
          <Bullet>To develop new features based on aggregate user behavior.</Bullet>
          <SubHead>Communications</SubHead>
          <Bullet>To send you service-related announcements and updates.</Bullet>
          <Bullet>To respond to your support requests.</Bullet>
          <Bullet>To send promotional communications about Tandem features or offers, where you have opted in.</Bullet>
        </Section>

        <Section title="3. How We Share Your Information">
          <SubHead>With Other Users</SubHead>
          <Bullet>Your profile information is visible to other users in accordance with your privacy settings.</Bullet>
          <Bullet>Activity posts you create are visible to other users. The level of detail visible may vary based on membership tier.</Bullet>
          <Bullet>When a mutual match occurs, both users are notified and can view each other's profiles and communicate via in-app chat.</Bullet>
          <SubHead>With Service Providers</SubHead>
          <Body>We share information with trusted third-party vendors who assist us in operating the Service, including cloud hosting, payment processing (Stripe), push notification delivery, analytics providers, and identity verification services.</Body>
          <SubHead>For Legal Reasons</SubHead>
          <Body>We may disclose your information if required by law, regulation, or legal process, or if we believe disclosure is necessary to protect the rights, property, or safety of Tandem, our users, or others.</Body>
          <SubHead>Business Transfers</SubHead>
          <Body>In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will notify you if this occurs.</Body>
          <SubHead>We Do Not Sell Your Data</SubHead>
          <Body>Tandem does not sell your personal information to third parties for their own marketing purposes.</Body>
        </Section>

        <Section title="4. Sensitive Information">
          <Bullet>Tandem collects certain categories of sensitive personal information, including sexual orientation, gender identity, and religion, solely to enable you to set your connection preferences and to improve matching relevance. This information is never sold.</Bullet>
          <Bullet>You are never required to provide sensitive information to use Tandem. You may skip or update these fields at any time in your profile settings.</Bullet>
        </Section>

        <Section title="5. Photos, Verification, and Identity">
          <Bullet>Photos you upload to your profile are stored securely and displayed to other users in accordance with your settings.</Bullet>
          <Bullet>Social account verification (Google or Apple) is used to confirm your identity. No facial recognition is used.</Bullet>
          <Bullet>We recommend that you only upload photos in which you have the right to share.</Bullet>
        </Section>

        <Section title="6. Location Data">
          <Bullet>Precise location is used to show you activity posts and potential Tandems near you, and to power the in-app map feature.</Bullet>
          <Bullet>You can disable location access at any time in your device settings.</Bullet>
          <Bullet>We do not share your precise real-time location with other users. General location (city or neighborhood level) may be displayed based on your settings.</Bullet>
        </Section>

        <Section title="7. Data Retention">
          <Bullet>We retain your account information for as long as your account is active. If you delete your account, we will delete or anonymize your personal information within 30 days.</Bullet>
          <Bullet>Activity history and scrapbook content is retained for the duration of your account. You can delete individual items at any time.</Bullet>
          <Bullet>Anonymized, aggregated data may be retained indefinitely for product analytics and improvement purposes.</Bullet>
        </Section>

        <Section title="8. Your Rights and Choices">
          <SubHead>Access, Correction, and Deletion</SubHead>
          <Bullet>You may access, update, or correct your profile information at any time through the app's Settings.</Bullet>
          <Bullet>You may request deletion of your account and associated personal data by navigating to Settings or by contacting us at tandemapp.hq@gmail.com.</Bullet>
          <Bullet>You may opt out of promotional communications by following the unsubscribe instructions in those messages or by adjusting your notification preferences in Settings.</Bullet>
          <SubHead>Rights Depending on Your Location</SubHead>
          <Body>If you are located in California, the European Economic Area, the United Kingdom, or other jurisdictions with applicable privacy laws, you may have additional rights, including the right to data portability and the right to lodge a complaint with a supervisory authority. To exercise these rights, contact us at tandemapp.hq@gmail.com.</Body>
        </Section>

        <Section title="9. Children's Privacy">
          <Body>Tandem is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from minors. If you believe a minor has created an account, please contact us at tandemapp.hq@gmail.com.</Body>
        </Section>

        <Section title="10. Data Security">
          <Bullet>We implement industry-standard technical and organizational measures to protect your information, including encryption in transit (TLS) and at rest, access controls, and regular security reviews.</Bullet>
          <Bullet>No method of transmission over the Internet is 100% secure. We encourage you to use a strong, unique password and to report any suspicious activity to us immediately.</Bullet>
        </Section>

        <Section title="11. Third-Party Links and Integrations">
          <Body>Tandem may integrate with or link to third-party services. This Privacy Policy does not govern the practices of those third parties, and we encourage you to review their privacy policies.</Body>
        </Section>

        <Section title="12. Notifications">
          <Bullet>Tandem may send push notifications for mutual matches, activity recommendations, confirmation reminders for upcoming meetups, and notifications when contacts join the platform.</Bullet>
          <Bullet>You can manage notification preferences at any time through your device settings or the in-app notification settings.</Bullet>
        </Section>

        <Section title="13. Changes to This Privacy Policy">
          <Body>We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy in the app. Your continued use of the Service after the effective date of any update constitutes acceptance of the revised policy.</Body>
        </Section>

        <Section title="14. Contact Us">
          <Body>If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:</Body>
          <Body>Tandem App, Inc. · tandemapp.hq@gmail.com · thetandemweb.com</Body>
          <Body>For EU/UK residents, our representative can be reached at the email above.</Body>
        </Section>

        <View style={s.footer}>
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
  backText: { fontSize: 14, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.teal },
  title: { fontSize: 17, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, letterSpacing: -0.3 },

  content: { paddingHorizontal: 20, paddingTop: 24, gap: 8 },

  wordmark: { fontSize: 28, fontWeight: "800", fontFamily: "Quicksand_700Bold", color: colors.teal, letterSpacing: -0.8 },
  tagline: { fontSize: 15, fontWeight: "600", fontFamily: "Quicksand_600SemiBold", color: colors.foreground, marginTop: 2 },
  intro: { fontSize: 13, color: colors.foreground, lineHeight: 21, marginBottom: 8 },

  section: { gap: 8, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.foreground, marginTop: 8 },
  subHead: { fontSize: 13, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal, marginTop: 4 },
  body: { fontSize: 13, color: colors.muted, lineHeight: 21 },
  bulletRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bulletDot: { fontSize: 15, color: colors.teal, lineHeight: 21, marginTop: -1 },
  bulletText: { flex: 1, fontSize: 13, color: colors.muted, lineHeight: 21 },

  footer: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border, gap: 4, alignItems: "center" },
  footerText: { fontSize: 12, color: colors.muted, textAlign: "center" },
  footerBrand: { fontSize: 13, fontWeight: "700", fontFamily: "Quicksand_700Bold", color: colors.teal, marginTop: 4 },
});
