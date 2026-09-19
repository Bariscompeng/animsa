/** The "leaving home" checklist shown when the home geofence is exited. */
import { useCallback, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';

import {
  Button,
  Caption,
  EmptyState,
  IconButton,
  Screen,
  SectionHeader,
  Separator,
  SwitchRow,
} from '@/components/ui';
import {
  addChecklistEntry,
  deleteChecklistEntry,
  listChecklist,
  updateChecklistEntry,
  type ChecklistEntry,
} from '@/db/repos/misc';
import { MIN_TOUCH, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function HomeExitScreen() {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<ChecklistEntry[]>([]);
  const [draft, setDraft] = useState('');

  const reload = useCallback(async () => {
    setEntries(await listChecklist());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const add = useCallback(async () => {
    if (!draft.trim()) return;
    await addChecklistEntry(draft);
    setDraft('');
    await reload();
  }, [draft, reload]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Evden çıkarken' }} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <SectionHeader>Kontrol listesi</SectionHeader>
        <Caption style={{ paddingHorizontal: space.lg, paddingBottom: space.md, lineHeight: 20 }}>
          {
            'Ev olarak işaretlediğin yerden çıktığında bu maddeler ve o günün "evden çıkarken" işaretli görevleri tek bildirimde hatırlatılır.'
          }
        </Caption>

        {entries.length === 0 ? (
          <EmptyState
            icon="door.left.hand.open"
            title="Liste boş"
            description="Anahtar, cüzdan, çöp gibi unutmak istemediğin şeyleri ekle."
          />
        ) : (
          entries.map((entry) => (
            <View key={entry.id}>
              <SwitchRow
                title={entry.text}
                value={entry.enabled}
                onValueChange={(v) => {
                  void updateChecklistEntry(entry.id, { enabled: v }).then(() => void reload());
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  right: 64,
                  top: 0,
                  bottom: 0,
                  justifyContent: 'center',
                }}
              >
                <IconButton
                  name="trash"
                  size={18}
                  color={colors.danger}
                  label={`${entry.text} maddesini sil`}
                  onPress={() => {
                    void deleteChecklistEntry(entry.id).then(() => void reload());
                  }}
                />
              </View>
              <Separator />
            </View>
          ))
        )}

        <View
          style={{
            flexDirection: 'row',
            gap: space.sm,
            padding: space.lg,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => void add()}
            returnKeyType="done"
            placeholder="Yeni madde"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Yeni kontrol listesi maddesi"
            style={{
              flex: 1,
              minHeight: MIN_TOUCH,
              paddingHorizontal: space.md,
              borderRadius: radius.md,
              backgroundColor: colors.card,
              color: colors.text,
              fontSize: 17,
            }}
          />
          <Button title="Ekle" onPress={() => void add()} disabled={!draft.trim()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
