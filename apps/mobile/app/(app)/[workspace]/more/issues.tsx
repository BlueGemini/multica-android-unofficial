import { Redirect, useLocalSearchParams } from "expo-router";

export default function LegacyIssuesRedirect() {
  const { workspace } = useLocalSearchParams<{ workspace: string }>();
  return (
    <Redirect
      href={{ pathname: "/[workspace]/work", params: { workspace } }}
    />
  );
}
