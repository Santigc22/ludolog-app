import { ModerationWorkspace } from "../../components/moderation/moderation-workspace";
import { EditionModerationWorkspace } from "../../components/moderation/edition-moderation-workspace";

export default function ModerationPage() {
  return (
    <main>
      <ModerationWorkspace />
      <EditionModerationWorkspace />
    </main>
  );
}
