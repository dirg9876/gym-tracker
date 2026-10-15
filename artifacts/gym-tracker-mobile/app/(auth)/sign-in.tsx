import { type Href, Redirect } from "expo-router";

export default function SignInPage() {
  return <Redirect href={"/(tabs)" as Href} />;
}
