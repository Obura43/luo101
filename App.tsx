import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  learningUnits,
  type LessonExercise,
  type LearningUnit,
  type Phrase,
} from './src/data/lessons';
import { getAudioForKey, hasAudioForKey } from './src/data/audioManifest';
import { dictionaryEntries, type DictionaryEntry } from './src/data/dictionary';

type Tab = 'learn' | 'lesson' | 'practice' | 'review' | 'phrases' | 'profile';
type UnitProgress = {
  correctExerciseIds: string[];
  mistakes: number;
  completedRounds: number;
  reviewCompleted: boolean;
};

type SavedProgress = {
  selectedUnitId: string;
  xp: number;
  streak: number;
  units: Record<string, UnitProgress>;
};

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};
type DocumentLike = { title: string };

const STORAGE_KEY = 'luo101-progress-v1';
const defaultUnitProgress: UnitProgress = {
  correctExerciseIds: [],
  mistakes: 0,
  completedRounds: 0,
  reviewCompleted: false,
};

function getStorage() {
  const candidate = globalThis as typeof globalThis & { localStorage?: StorageLike };
  return candidate.localStorage ?? null;
}

function readProgress(): SavedProgress | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  try {
    const rawProgress = storage.getItem(STORAGE_KEY);
    return rawProgress ? (JSON.parse(rawProgress) as SavedProgress) : null;
  } catch {
    return null;
  }
}

function writeProgress(progress: SavedProgress) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function setDocumentTitle(title: string) {
  const candidate = globalThis as typeof globalThis & { document?: DocumentLike };

  if (candidate.document) {
    candidate.document.title = title;
  }
}

export default function App() {
  const savedProgress = useMemo(() => readProgress(), []);
  const [tab, setTab] = useState<Tab>('learn');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [built, setBuilt] = useState<string[]>([]);
  const [xp, setXp] = useState(savedProgress?.xp ?? 120);
  const [streak, setStreak] = useState(savedProgress?.streak ?? 4);
  const [selectedUnitId, setSelectedUnitId] = useState(savedProgress?.selectedUnitId ?? learningUnits[0].id);
  const [unitProgressById, setUnitProgressById] = useState<Record<string, UnitProgress>>(savedProgress?.units ?? {});

  const unitIndex = Math.max(
    learningUnits.findIndex((unit) => unit.id === selectedUnitId),
    0,
  );
  const unit = learningUnits[unitIndex];
  const nextUnit = learningUnits[unitIndex + 1];
  const unitLabel = unit.unitLabel ?? `Unit ${unitIndex + 1}`;
  const nextUnitLabel = nextUnit?.unitLabel ?? (nextUnit ? `Unit ${unitIndex + 2}` : undefined);
  const unitProgress = unitProgressById[unit.id] ?? defaultUnitProgress;
  const { correctExerciseIds, mistakes, completedRounds, reviewCompleted } = unitProgress;

  const exercise = unit.exercises[exerciseIndex] ?? unit.exercises[0];
  const builtAnswer = built.join(' ');
  const submittedAnswer = exercise.type === 'build' ? builtAnswer : selected;
  const isCorrect = submittedAnswer === exercise.answer;
  const hasAnswered = submittedAnswer !== null && submittedAnswer.length > 0;
  const lessonProgress = correctExerciseIds.length / unit.exercises.length;
  const isPracticeComplete = correctExerciseIds.length === unit.exercises.length;
  const isUnitComplete = isPracticeComplete && reviewCompleted;
  const activeLessonIndex = isPracticeComplete
    ? unit.lessons.length - 1
    : Math.min(
        Math.floor((correctExerciseIds.length / unit.exercises.length) * unit.lessons.length),
        unit.lessons.length - 1,
      );

  const pathStatus = useMemo(
    () =>
      unit.lessons.map((lesson, index) => ({
        ...lesson,
        status:
          isUnitComplete || index < activeLessonIndex
            ? 'complete'
            : index === activeLessonIndex
              ? 'active'
              : 'locked',
        isCurrent: !isUnitComplete && index === activeLessonIndex,
      })),
    [activeLessonIndex, isUnitComplete, unit.lessons],
  );

  useEffect(() => {
    setDocumentTitle('Luo101');
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);

  useEffect(() => {
    writeProgress({
      selectedUnitId,
      xp,
      streak,
      units: unitProgressById,
    });
  }, [selectedUnitId, xp, streak, unitProgressById]);

  useEffect(() => {
    resetExercise(0);
  }, [selectedUnitId]);

  function updateUnitProgress(updater: (current: UnitProgress) => UnitProgress) {
    setUnitProgressById((current) => ({
      ...current,
      [unit.id]: updater(current[unit.id] ?? defaultUnitProgress),
    }));
  }

  function resetExercise(nextIndex = exerciseIndex) {
    setExerciseIndex(nextIndex);
    setSelected(null);
    setBuilt([]);
  }

  function restartUnit(startTab: Tab) {
    updateUnitProgress((current) => ({
      ...current,
      correctExerciseIds: [],
      mistakes: 0,
      reviewCompleted: false,
    }));
    resetExercise(0);
    setTab(startTab);
  }

  function goToNextUnit() {
    if (!nextUnit) {
      return;
    }

    selectUnit(nextUnit.id, 'learn');
  }

  function selectUnit(unitId: string, nextTab: Tab = 'learn') {
    setSelectedUnitId(unitId);
    setTab(nextTab);
  }

  function continueLesson() {
    if (!hasAnswered) {
      return;
    }

    if (!isCorrect) {
      updateUnitProgress((current) => ({ ...current, mistakes: current.mistakes + 1 }));
      resetExercise(exerciseIndex);
      return;
    }

    const nextCorrectIds = correctExerciseIds.includes(exercise.id)
      ? correctExerciseIds
      : [...correctExerciseIds, exercise.id];

    updateUnitProgress((current) => ({ ...current, correctExerciseIds: nextCorrectIds }));
    setXp((current) => current + 5);

    if (nextCorrectIds.length === unit.exercises.length) {
      resetExercise(0);
      setTab('review');
      return;
    }

    const nextIndex = (exerciseIndex + 1) % unit.exercises.length;
    resetExercise(nextIndex);
  }

  return (
    <SafeAreaView style={styles.shell}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View style={styles.topBarInner}>
          <View>
            <Text style={styles.brand}>Luo101</Text>
            <Text style={styles.brandSub}>Learn Dholuo. Speak it. Pass it on.</Text>
          </View>
          <View style={styles.statsRow}>
            <Stat label="XP" value={xp.toString()} />
            <Stat label="Day" value={streak.toString()} />
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {tab === 'learn' ? (
          <LearnScreen
            completedRounds={completedRounds}
            lessonProgress={lessonProgress}
            mistakes={mistakes}
            nextPhrase={unit.phrases[Math.min(correctExerciseIds.length, unit.phrases.length - 1)]}
            nextUnit={nextUnit}
            pathStatus={pathStatus}
            unit={unit}
            unitLabel={unitLabel}
            nextUnitLabel={nextUnitLabel}
            selectedUnitId={selectedUnitId}
            unitProgressById={unitProgressById}
            onContinueUnit={goToNextUnit}
            onRestart={() => restartUnit('lesson')}
            onSelectUnit={selectUnit}
            onStart={() => setTab('lesson')}
          />
        ) : null}
        {tab === 'review' ? (
          <ReviewScreen
            mistakes={mistakes}
            unit={unit}
            unitLabel={unitLabel}
            onComplete={() => {
              updateUnitProgress((current) => ({
                ...current,
                completedRounds: current.completedRounds + 1,
                reviewCompleted: true,
              }));
              setStreak((current) => current + 1);
              setTab('learn');
            }}
            onPracticeAgain={() => restartUnit('practice')}
          />
        ) : null}
        {tab === 'lesson' ? <LessonScreen unit={unit} onBeginPractice={() => setTab('practice')} /> : null}
        {tab === 'practice' ? (
          <PracticeScreen
            exercise={exercise}
            exerciseIndex={exerciseIndex}
            selected={selected}
            built={built}
            hasAnswered={hasAnswered}
            isCorrect={isCorrect}
            unit={unit}
            onSelect={setSelected}
            onBuild={(tile) => setBuilt((current) => [...current, tile])}
            onClear={() => setBuilt([])}
            onContinue={continueLesson}
          />
        ) : null}
        {tab === 'phrases' ? <PhrasebookScreen units={learningUnits} /> : null}
        {tab === 'profile' ? (
          <ProfileScreen
            completedRounds={completedRounds}
            lessonProgress={lessonProgress}
            mistakes={mistakes}
            unit={unit}
            unitProgressById={unitProgressById}
            xp={xp}
            streak={streak}
            selectedUnitId={selectedUnitId}
            onSelectUnit={selectUnit}
          />
        ) : null}
      </ScrollView>

      <View style={styles.nav}>
        <NavButton label="Learn" active={tab === 'learn'} onPress={() => setTab('learn')} />
        <NavButton label="Practice" active={tab === 'practice' || tab === 'lesson' || tab === 'review'} onPress={() => setTab('lesson')} />
        <NavButton label="Phrases" active={tab === 'phrases'} onPress={() => setTab('phrases')} />
        <NavButton label="Profile" active={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>
    </SafeAreaView>
  );
}

function LearnScreen({
  completedRounds,
  lessonProgress,
  mistakes,
  nextUnit,
  nextPhrase,
  pathStatus,
  unit,
  unitLabel,
  nextUnitLabel,
  selectedUnitId,
  unitProgressById,
  onContinueUnit,
  onRestart,
  onSelectUnit,
  onStart,
}: {
  completedRounds: number;
  lessonProgress: number;
  mistakes: number;
  nextUnit: LearningUnit | undefined;
  nextPhrase: Phrase;
  pathStatus: Array<{ title: string; status: string; detail: string; isCurrent: boolean }>;
  unit: LearningUnit;
  unitLabel: string;
  nextUnitLabel: string | undefined;
  selectedUnitId: string;
  unitProgressById: Record<string, UnitProgress>;
  onContinueUnit: () => void;
  onRestart: () => void;
  onSelectUnit: (unitId: string, nextTab?: Tab) => void;
  onStart: () => void;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 620;
  const isComplete = lessonProgress === 1;
  const drillsDone = Math.round(lessonProgress * unit.exercises.length);
  const statusLabel = isComplete ? 'Mastered' : drillsDone > 0 ? 'In progress' : 'Not started';
  const nextLesson = pathStatus.find((lesson) => lesson.isCurrent);

  return (
    <View style={styles.learnPage}>
      <View style={[styles.hero, isCompact && styles.heroCompact]}>
        <View style={styles.heroCopy}>
          <View style={[styles.heroTopline, isCompact && styles.heroToplineCompact]}>
            <Text style={styles.kickerOnDark}>{unitLabel}</Text>
            <Text style={styles.heroPill}>{statusLabel}</Text>
          </View>
          <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>{unit.title}</Text>
          <Text style={[styles.heroText, isCompact && styles.heroTextCompact]}>{unit.subtitle}</Text>
          <Text style={[styles.heroMission, isCompact && styles.heroMissionCompact]}>A living language carries memory, family, humor, song, and belonging. Luo101 helps learners preserve and pass on the beauty of Luo culture one useful phrase at a time.</Text>
          <Text style={[styles.heroGoal, isCompact && styles.heroGoalCompact]}>{unit.goal}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(lessonProgress, 0.08) * 100}%` }]} />
          </View>
          <Text style={styles.heroProgressText}>
            {drillsDone} of {unit.exercises.length} drills complete
          </Text>
        </View>
        <View style={[styles.mascotMark, isCompact && styles.mascotMarkCompact]}>
          <Text style={styles.mascotTop}>LUO</Text>
          <Text style={styles.mascotBottom}>01</Text>
        </View>
      </View>

      <View style={[styles.learnGrid, isCompact && styles.learnGridCompact]}>
        <View style={styles.learnMetric}>
          <Text style={styles.learnMetricValue}>{unit.xp}</Text>
          <Text style={styles.learnMetricLabel}>XP available</Text>
        </View>
        <View style={styles.learnMetric}>
          <Text style={styles.learnMetricValue}>{mistakes}</Text>
          <Text style={styles.learnMetricLabel}>misses</Text>
        </View>
        <View style={styles.learnMetric}>
          <Text style={styles.learnMetricValue}>{completedRounds}</Text>
          <Text style={styles.learnMetricLabel}>rounds</Text>
        </View>
      </View>



      {!isCompact ? (
        <UnitSelector
          compact={false}
          selectedUnitId={selectedUnitId}
          unitProgressById={unitProgressById}
          onSelectUnit={(unitId) => onSelectUnit(unitId, 'learn')}
        />
      ) : null}
      <View style={[styles.nextCard, isCompact && styles.nextCardCompact]}>
        <View style={styles.nextCopy}>
          <Text style={styles.cardLabel}>{isComplete ? 'Review Phrase' : 'Next Up'}</Text>
          <Text style={styles.nextTitle}>{isComplete ? `${unit.title} mastered` : nextLesson?.title}</Text>
          <Text style={styles.nextText}>
            {isComplete
              ? nextUnit
                ? `Practice again, or continue to ${nextUnitLabel}: ${nextUnit.title}.`
                : 'Practice again to make the basics feel quick, natural, and spoken.'
              : `Start with "${nextPhrase.dholuo}" and learn when it sounds natural.`}
          </Text>
        </View>
        <View style={[styles.phraseChip, isCompact && styles.phraseChipCompact]}>
          <Text style={styles.phraseChipText}>{nextPhrase.dholuo}</Text>
          <Text style={styles.phraseChipSub}>{nextPhrase.english}</Text>
        </View>
      </View>

      {isComplete && nextUnit ? (
        <>
          <Pressable style={styles.primaryButton} onPress={onContinueUnit}>
            <Text style={styles.primaryButtonText}>Continue to {nextUnitLabel}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onRestart}>
            <Text style={styles.secondaryButtonText}>Practice Again</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.primaryButton} onPress={isComplete ? onRestart : onStart}>
          <Text style={styles.primaryButtonText}>{isComplete ? 'Practice Again' : 'Start Lesson'}</Text>
        </Pressable>
      )}


      {isCompact ? (
        <UnitSelector
          compact
          selectedUnitId={selectedUnitId}
          unitProgressById={unitProgressById}
          onSelectUnit={(unitId) => onSelectUnit(unitId, 'learn')}
        />
      ) : null}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, isCompact && styles.sectionTitleCompact]}>Today&apos;s Path</Text>
        <Text style={styles.sectionMeta}>{Math.round(lessonProgress * 100)}%</Text>
      </View>

      <View style={styles.path}>
        {pathStatus.map((lesson, index) => (
          <View
            key={lesson.title}
            style={[
              styles.pathItem,
              isCompact && styles.pathItemCompact,
              lesson.isCurrent && styles.pathItemActive,
              lesson.status === 'complete' && styles.pathItemComplete,
            ]}
          >
            <View
              style={[
                styles.pathDot,
                isCompact && styles.pathDotCompact,
                lesson.status === 'complete' && styles.pathDotComplete,
                lesson.isCurrent && styles.pathDotActive,
              ]}
            >
              <Text style={styles.pathDotText}>{index + 1}</Text>
            </View>
            <View style={styles.pathCopy}>
              <View style={[styles.pathTitleRow, isCompact && styles.pathTitleRowCompact]}>
                <Text style={[styles.pathTitle, isCompact && styles.pathTitleCompact]}>{lesson.title}</Text>
                <Text
                  style={[
                    styles.pathState,
                    lesson.status === 'active' && styles.pathStateActive,
                    lesson.status === 'complete' && styles.pathStateComplete,
                  ]}
                >
                  {lesson.status}
                </Text>
              </View>
              <Text style={styles.pathDetail}>{lesson.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      {isComplete ? (
        <View style={styles.completeCard}>
          <Text style={styles.completeTitle}>{unit.title}</Text>
          <Text style={styles.completeText}>
            Unit complete. You earned {unit.xp} XP and your progress is saved on this device.
          </Text>
          <View style={styles.completeStats}>
            <Stat label="Rounds" value={completedRounds.toString()} />
            <Stat label="Misses" value={mistakes.toString()} />
          </View>
        </View>
      ) : null}

      <View style={[styles.learnBottomGrid, isCompact && styles.learnBottomGridCompact]}>
        <View style={styles.cultureCard}>
          <Text style={styles.cardLabel}>Culture Note</Text>
          <Text style={styles.cultureText}>{unit.cultureNote}</Text>
        </View>
        <View style={styles.cultureCard}>
          <Text style={styles.cardLabel}>Mini Dialogue</Text>
          {unit.conversation.slice(0, 2).map((line) => (
            <Text key={`preview-${line.speaker}-${line.line}`} style={styles.dialoguePreview}>
              {line.speaker}: {line.line}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function LessonScreen({ unit, onBeginPractice }: { unit: LearningUnit; onBeginPractice: () => void }) {
  if (unit.id === 'dictionary-az') {
    return <DictionaryScreen unit={unit} />;
  }

  return (
    <View>
      <View style={styles.lessonHero}>
        <Text style={styles.kickerOnDark}>Teach First</Text>
        <Text style={styles.lessonHeroTitle}>Meet {unit.title}</Text>
        <Text style={styles.lessonHeroText}>
          Read the phrases out loud, notice the pattern, then practice once the language feels familiar.
        </Text>
      </View>

      <View style={styles.teachSteps}>
        {unit.teachingPoints.map((point, index) => (
          <View key={point.focus} style={styles.teachCard}>
            <View style={styles.teachNumber}>
              <Text style={styles.teachNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.teachCopy}>
              <Text style={styles.cardLabel}>{point.title}</Text>
              <Text style={styles.teachFocus}>{point.focus}</Text>
              <Text style={styles.teachTranslation}>{point.translation}</Text>
              <Text style={styles.teachDetail}>{point.detail}</Text>
              <View style={styles.exampleStrip}>
                <Text style={styles.exampleText}>{point.example}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.patternCard}>
        <Text style={styles.cardLabel}>Pattern</Text>
        <View style={styles.patternRow}>
          {unit.patternLabels.map((label, index) => (
            <View key={label} style={styles.patternRow}>
              <Text style={styles.patternStep}>{label}</Text>
              {index < unit.patternLabels.length - 1 ? <Text style={styles.patternArrow}>+</Text> : null}
            </View>
          ))}
        </View>
        <Text style={styles.patternLine}>{unit.patternLine}</Text>
      </View>

      {unit.readings?.length ? <ReadingLibrary readings={unit.readings} /> : null}

      <View style={styles.guidedDialogueCard}>
        <Text style={styles.cardLabel}>Guided Conversation</Text>
        {unit.conversation.map((line) => (
          <View key={`teach-${line.speaker}-${line.line}`} style={styles.guidedDialogueLine}>
            <Text style={styles.dialogueSpeaker}>{line.speaker}</Text>
            <Text style={styles.dialogueText}>{line.line}</Text>
            <Text style={styles.dialogueTranslation}>{line.translation}</Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={onBeginPractice}>
        <Text style={styles.primaryButtonText}>Begin Practice</Text>
      </Pressable>
    </View>
  );
}

function normalizeDictionaryKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanDictionaryPhrase(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function buildCurriculumDictionaryEntries(units: LearningUnit[]): DictionaryEntry[] {
  const entries: DictionaryEntry[] = [];

  function addEntry(dholuo: string | undefined, english: string | undefined, category: string, note: string) {
    const cleanDholuo = cleanDictionaryPhrase(dholuo ?? '');
    const cleanEnglish = cleanDictionaryPhrase(english ?? '');

    if (!cleanDholuo || !cleanEnglish) {
      return;
    }

    entries.push({
      dholuo: cleanDholuo.replace(/[.!?]+$/g, ''),
      english: cleanEnglish.replace(/[.!?]+$/g, ''),
      category,
      note,
    });
  }

  units
    .filter((unit) => unit.id !== 'dictionary-az')
    .forEach((unit, index) => {
      const unitName = `${unit.unitLabel ?? `Unit ${index + 1}`}: ${unit.title}`;

      addEntry(unit.patternLine, unit.goal, 'Unit pattern', unitName);

      unit.phrases.forEach((phrase) => {
        addEntry(phrase.dholuo, phrase.english, phrase.category || 'Curriculum phrase', `${unitName}. ${phrase.usage}`);
      });

      unit.teachingPoints.forEach((point) => {
        addEntry(point.focus, point.translation, 'Teaching focus', `${unitName}. ${point.title}`);
        addEntry(point.example, point.translation, 'Teaching example', `${unitName}. ${point.detail}`);
      });

      unit.conversation.forEach((line) => {
        addEntry(line.line, line.translation, 'Dialogue', `${unitName}. Speaker: ${line.speaker}`);
      });

      unit.readings?.forEach((reading) => {
        reading.lines.forEach((line) => {
          addEntry(line.dholuo, line.english, 'Reading line', `${unitName}. ${reading.title}`);
        });
        reading.vocabulary.forEach((word) => {
          addEntry(word.dholuo, word.english, 'Reading vocabulary', `${unitName}. ${reading.title}`);
        });
      });

      unit.review.forEach((item) => {
        addEntry(item.dholuo, item.english, 'Review item', `${unitName}. ${item.cue}`);
      });
    });

  return entries;
}

function mergeDictionaryEntries(primaryEntries: DictionaryEntry[], curriculumEntries: DictionaryEntry[]) {
  const byWord = new Map<string, DictionaryEntry>();

  [...primaryEntries, ...curriculumEntries].forEach((entry) => {
    const key = normalizeDictionaryKey(entry.dholuo);
    const existing = byWord.get(key);

    if (!existing) {
      byWord.set(key, entry);
      return;
    }

    const hasDifferentMeaning = !existing.english.toLowerCase().includes(entry.english.toLowerCase());
    const mergedNote = [existing.note, entry.note].filter(Boolean).join(' | ');

    byWord.set(key, {
      ...existing,
      english: hasDifferentMeaning ? `${existing.english} / ${entry.english}` : existing.english,
      category: existing.category === entry.category ? existing.category : `${existing.category} + ${entry.category}`,
      note: mergedNote || undefined,
    });
  });

  return Array.from(byWord.values()).sort((first, second) => first.dholuo.localeCompare(second.dholuo));
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[.!?,;:]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDictionaryCategories(entry: DictionaryEntry) {
  return entry.category.split(' + ').map((category) => category.trim()).filter(Boolean);
}

function DictionaryScreen({ unit }: { unit: LearningUnit }) {
  const [query, setQuery] = useState('');
  const [selectedLetter, setSelectedLetter] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const curriculumDictionaryEntries = useMemo(() => buildCurriculumDictionaryEntries(learningUnits), []);
  const allDictionaryEntries = useMemo(
    () => mergeDictionaryEntries(dictionaryEntries, curriculumDictionaryEntries),
    [curriculumDictionaryEntries],
  );
  const letters = useMemo(
    () => ['All', ...Array.from(new Set(allDictionaryEntries.map((entry) => entry.dholuo.charAt(0).toUpperCase()))).sort()],
    [allDictionaryEntries],
  );
  const categories = useMemo(
    () => [
      'All',
      ...Array.from(new Set(allDictionaryEntries.flatMap((entry) => getDictionaryCategories(entry)))).sort(),
    ],
    [allDictionaryEntries],
  );
  const normalizedQuery = normalizeSearchText(query);
  const hasActiveFilters = Boolean(normalizedQuery) || selectedLetter !== 'All' || selectedCategory !== 'All';
  const filteredEntries = useMemo(
    () =>
      allDictionaryEntries.filter((entry) => {
        const matchesLetter = selectedLetter === 'All' || entry.dholuo.charAt(0).toUpperCase() === selectedLetter;
        const matchesCategory = selectedCategory === 'All' || getDictionaryCategories(entry).includes(selectedCategory);
        const searchable = normalizeSearchText(`${entry.dholuo} ${entry.english} ${entry.category} ${entry.note ?? ''}`);
        return matchesLetter && matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
      }),
    [allDictionaryEntries, normalizedQuery, selectedCategory, selectedLetter],
  );

  function clearDictionaryFilters() {
    setQuery('');
    setSelectedLetter('All');
    setSelectedCategory('All');
  }

  return (
    <View>
      <View style={styles.lessonHero}>
        <Text style={styles.kickerOnDark}>{unit.unitLabel}</Text>
        <Text style={styles.lessonHeroTitle}>{unit.title}</Text>
        <Text style={styles.lessonHeroText}>{unit.subtitle}</Text>
      </View>

      <View style={styles.dictionarySearchCard}>
        <Text style={styles.cardLabel}>Search Dictionary</Text>
        <TextInput
          accessibilityLabel="Search Luo dictionary"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search Luo or English, e.g. pi, water, because"
          placeholderTextColor="#7A8A82"
          style={styles.dictionaryInput}
          value={query}
        />

        <View style={styles.dictionaryStats}>
          <View style={styles.dictionaryStat}>
            <Text style={styles.dictionaryStatValue}>{dictionaryEntries.length}</Text>
            <Text style={styles.dictionaryStatLabel}>Curated</Text>
          </View>
          <View style={styles.dictionaryStat}>
            <Text style={styles.dictionaryStatValue}>{curriculumDictionaryEntries.length}</Text>
            <Text style={styles.dictionaryStatLabel}>From lessons</Text>
          </View>
          <View style={styles.dictionaryStat}>
            <Text style={styles.dictionaryStatValue}>{allDictionaryEntries.length}</Text>
            <Text style={styles.dictionaryStatLabel}>A-Z total</Text>
          </View>
        </View>

        <Text style={styles.dictionaryFilterLabel}>Letters</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.dictionaryLetters}>
          {letters.map((letter) => (
            <Pressable
              key={letter}
              accessibilityRole="button"
              onPress={() => setSelectedLetter(letter)}
              style={[styles.dictionaryLetter, selectedLetter === letter && styles.dictionaryLetterActive]}
            >
              <Text style={[styles.dictionaryLetterText, selectedLetter === letter && styles.dictionaryLetterTextActive]}>
                {letter}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.dictionaryFilterLabel}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.dictionaryCategories}>
          {categories.map((category) => (
            <Pressable
              key={category}
              accessibilityRole="button"
              onPress={() => setSelectedCategory(category)}
              style={[styles.dictionaryCategoryChip, selectedCategory === category && styles.dictionaryCategoryChipActive]}
            >
              <Text
                style={[
                  styles.dictionaryCategoryText,
                  selectedCategory === category && styles.dictionaryCategoryTextActive,
                ]}
              >
                {category}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.dictionaryActions}>
          <Text style={styles.dictionaryMeta}>
            {filteredEntries.length} of {allDictionaryEntries.length} entries shown
          </Text>
          {hasActiveFilters ? (
            <Pressable accessibilityRole="button" onPress={clearDictionaryFilters} style={styles.dictionaryClearButton}>
              <Text style={styles.dictionaryClearText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.dictionaryNotice}>
        <Text style={styles.dictionaryNoticeTitle}>Speaker-reviewed word bank</Text>
        <Text style={styles.dictionaryNoticeText}>
          This A-Z dictionary now includes the curated word bank plus phrases, readings, dialogue, review items, and vocabulary used across Units 1-11. Keep expanding it with speaker-reviewed words.
        </Text>
      </View>

      <View style={styles.dictionaryResults}>
        {filteredEntries.length ? (
          filteredEntries.map((entry) => (
            <View key={`${entry.dholuo}-${entry.english}`} style={styles.dictionaryCard}>
              <View style={styles.dictionaryCardTop}>
                <Text style={styles.dictionaryWord}>{entry.dholuo}</Text>
                <Text style={styles.dictionaryCategory}>{entry.category}</Text>
              </View>
              <Text style={styles.dictionaryMeaning}>{entry.english}</Text>
              {entry.note ? (
                <View style={styles.dictionaryNoteBlock}>
                  <Text style={styles.dictionaryNoteLabel}>Source / usage</Text>
                  <Text style={styles.dictionaryNote}>{entry.note}</Text>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <View style={styles.dictionaryEmpty}>
            <Text style={styles.dictionaryEmptyTitle}>No match yet</Text>
            <Text style={styles.dictionaryEmptyText}>
              Try a broader search, clear the filters, or add this word to the next speaker-reviewed batch.
            </Text>
            <Pressable accessibilityRole="button" onPress={clearDictionaryFilters} style={styles.dictionaryClearButton}>
              <Text style={styles.dictionaryClearText}>Clear filters</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
function ReadingLibrary({ readings }: { readings: NonNullable<LearningUnit['readings']> }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <View style={styles.readingSection}>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Read In Context</Text>
        <Text style={styles.sectionMeta}>{readings.length} readings</Text>
      </View>
      {readings.map((reading) => {
        const isRevealed = Boolean(revealed[reading.id]);
        return (
          <View key={reading.id} style={styles.readingCard}>
            <View style={styles.readingTopline}>
              <Text style={styles.cardLabel}>{reading.kind}</Text>
              <Text style={styles.readingCount}>{reading.lines.length} lines</Text>
            </View>
            <Text style={styles.readingTitle}>{reading.title}</Text>
            <Text style={styles.readingEnglishTitle}>{reading.englishTitle}</Text>
            <Text style={styles.readingIntroduction}>{reading.introduction}</Text>
            <View style={styles.readingLines}>
              {reading.lines.map((line, index) => (
                <View key={`${reading.id}-${index}`} style={styles.readingLine}>
                  <Text style={styles.readingLineNumber}>{index + 1}</Text>
                  <View style={styles.readingLineCopy}>
                    <Text style={styles.readingDholuo}>{line.dholuo}</Text>
                    {isRevealed ? <Text style={styles.readingEnglish}>{line.english}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              style={styles.readingRevealButton}
              onPress={() => setRevealed((current) => ({ ...current, [reading.id]: !isRevealed }))}
            >
              <Text style={styles.readingRevealText}>{isRevealed ? 'Hide English' : 'Reveal English'}</Text>
            </Pressable>
            <View style={styles.readingVocabulary}>
              {reading.vocabulary.map((word) => (
                <View key={`${reading.id}-${word.dholuo}`} style={styles.readingWord}>
                  <Text style={styles.readingWordDholuo}>{word.dholuo}</Text>
                  <Text style={styles.readingWordEnglish}>{word.english}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ReviewScreen({
  mistakes,
  unit,
  unitLabel,
  onComplete,
  onPracticeAgain,
}: {
  mistakes: number;
  unit: LearningUnit;
  unitLabel: string;
  onComplete: () => void;
  onPracticeAgain: () => void;
}) {
  return (
    <View>
      <View style={styles.reviewHero}>
        <Text style={styles.kickerOnDark}>Final Review</Text>
        <Text style={styles.lessonHeroTitle}>Can you follow {unit.title}?</Text>
        <Text style={styles.lessonHeroText}>
          Review the phrases, scan the recap, then mark {unitLabel} complete when it feels familiar.
        </Text>
      </View>

      <View style={styles.reviewGrid}>
        {unit.review.map((item) => (
          <View key={item.dholuo} style={styles.reviewCard}>
            <Text style={styles.cardLabel}>{item.cue}</Text>
            <Text style={styles.reviewPhrase}>{item.dholuo}</Text>
            <Text style={styles.reviewTranslation}>{item.english}</Text>
          </View>
        ))}
      </View>

      {unit.readings?.length ? <ReadingLibrary readings={unit.readings} /> : null}

      <View style={styles.guidedDialogueCard}>
        <Text style={styles.cardLabel}>Slow Conversation Recap</Text>
        {unit.conversation.map((line) => (
          <View key={`review-${line.speaker}-${line.line}`} style={styles.guidedDialogueLine}>
            <Text style={styles.dialogueSpeaker}>{line.speaker}</Text>
            <Text style={styles.dialogueText}>{line.line}</Text>
            <Text style={styles.dialogueTranslation}>{line.translation}</Text>
          </View>
        ))}
      </View>

      <View style={styles.reviewFooterCard}>
        <Text style={styles.reviewFooterTitle}>Ready check</Text>
        <Text style={styles.reviewFooterText}>
          You finished {unit.exercises.length} drills with {mistakes} misses. A real unit should end with recognition,
          not just a score.
        </Text>
      </View>

      <Pressable style={styles.primaryButton} onPress={onComplete}>
        <Text style={styles.primaryButtonText}>Complete {unitLabel}</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={onPracticeAgain}>
        <Text style={styles.secondaryButtonText}>Practice Again</Text>
      </Pressable>
    </View>
  );
}

function PracticeScreen({
  exercise,
  exerciseIndex,
  selected,
  built,
  hasAnswered,
  isCorrect,
  unit,
  onSelect,
  onBuild,
  onClear,
  onContinue,
}: {
  exercise: LessonExercise;
  exerciseIndex: number;
  selected: string | null;
  built: string[];
  hasAnswered: boolean;
  isCorrect: boolean;
  unit: LearningUnit;
  onSelect: (value: string) => void;
  onBuild: (value: string) => void;
  onClear: () => void;
  onContinue: () => void;
}) {
  const remainingTiles = exercise.type === 'build'
    ? exercise.tiles
        .map((tile, index) => ({ index, tile }))
        .filter(({ index, tile }) => {
          const usedCount = built.filter((builtTile) => builtTile === tile).length;
          const tilePosition = exercise.tiles.slice(0, index + 1).filter((item) => item === tile).length;
          return tilePosition > usedCount;
        })
    : [];

  return (
    <View>
      <View style={styles.practiceHeader}>
        <Text style={styles.kicker}>Practice</Text>
        <Text style={styles.exerciseCount}>Drill {exerciseIndex + 1} of {unit.exercises.length}</Text>
      </View>
      <Text style={styles.prompt}>{exercise.prompt}</Text>

      {exercise.type === 'choice' ? (
        <View style={styles.optionGrid}>
          {exercise.options.map((option) => (
            <Pressable
              key={option}
              style={[
                styles.option,
                selected === option && styles.optionSelected,
                selected === option && option === exercise.answer && styles.optionCorrect,
                selected === option && option !== exercise.answer && styles.optionWrong,
              ]}
              disabled={hasAnswered}
              onPress={() => onSelect(option)}
            >
              <Text style={styles.optionText}>{option}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View>
          <View style={styles.answerTray}>
            <Text style={styles.answerText}>{built.length ? built.join(' ') : 'Tap words below'}</Text>
          </View>
          <View style={styles.tileRow}>
            {remainingTiles.map(({ index, tile }) => (
              <Pressable key={`${tile}-${index}`} style={styles.tile} onPress={() => onBuild(tile)}>
                <Text style={styles.tileText}>{tile}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.secondaryButton} onPress={onClear}>
            <Text style={styles.secondaryButtonText}>Clear</Text>
          </Pressable>
        </View>
      )}

      {hasAnswered ? (
        <View style={[styles.feedback, isCorrect ? styles.feedbackGood : styles.feedbackBad]}>
          <Text style={styles.feedbackTitle}>{isCorrect ? 'Correct' : 'Try this again'}</Text>
          <Text style={styles.feedbackText}>{exercise.note}</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.primaryButton, !hasAnswered && styles.primaryButtonDisabled]}
        disabled={!hasAnswered}
        onPress={onContinue}
      >
        <Text style={styles.primaryButtonText}>{!hasAnswered ? 'Check' : isCorrect ? 'Continue' : 'Retry'}</Text>
      </Pressable>

      <View style={styles.dialogue}>
        {unit.conversation.map((line) => (
          <View key={`${line.speaker}-${line.line}`} style={styles.dialogueLine}>
            <Text style={styles.dialogueSpeaker}>{line.speaker}</Text>
            <Text style={styles.dialogueText}>{line.line}</Text>
            <Text style={styles.dialogueTranslation}>{line.translation}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PhrasebookScreen({ units }: { units: LearningUnit[] }) {
  const { width } = useWindowDimensions();
  const isWide = width >= 920;
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null);
  const [audioErrorKey, setAudioErrorKey] = useState<string | null>(null);
  const activeAudioRef = useRef<{ key: string; player: ReturnType<typeof createAudioPlayer> } | null>(null);
  const phrases = units.flatMap((unit, index) =>
    unit.phrases.map((phrase) => ({
      ...phrase,
      unitLabel: `${unit.unitLabel ?? `Unit ${index + 1}`}: ${unit.title}`,
    })),
  );
  const recordedCount = phrases.filter((phrase) => hasAudioForKey(phrase.audioKey)).length;

  useEffect(
    () => () => {
      activeAudioRef.current?.player.release();
      activeAudioRef.current = null;
    },
    [],
  );

  function playPhraseAudio(audioKey: string) {
    const audio = getAudioForKey(audioKey);

    if (!audio) {
      return;
    }

    try {
      activeAudioRef.current?.player.pause();
      activeAudioRef.current?.player.release();

      const player = createAudioPlayer(audio.source);
      activeAudioRef.current = { key: audioKey, player };
      setAudioErrorKey(null);
      setPlayingAudioKey(audioKey);
      player.seekTo(0);
      player.play();

      setTimeout(() => {
        if (activeAudioRef.current?.key === audioKey) {
          setPlayingAudioKey(null);
        }
      }, 4200);
    } catch {
      setPlayingAudioKey(null);
      setAudioErrorKey(audioKey);
    }
  }

  return (
    <View style={styles.phrasebookPage}>
      <View style={[styles.phrasebookHero, !isWide && styles.phrasebookHeroCompact]}>
        <View style={styles.phrasebookHeroCopy}>
          <Text style={styles.kickerOnDark}>Phrasebook</Text>
          <Text style={styles.phrasebookTitle}>Hear Dholuo. Keep it close.</Text>
          <Text style={styles.phrasebookIntro}>
            A growing bank of useful phrases, greetings, family language, stories, and everyday words for practicing sound and preserving speech.
          </Text>
        </View>
        <View style={[styles.phrasebookStats, !isWide && styles.phrasebookStatsCompact]}>
          <View style={styles.phrasebookStat}>
            <Text style={styles.phrasebookStatValue}>{phrases.length}</Text>
            <Text style={styles.phrasebookStatLabel}>phrases</Text>
          </View>
          <View style={styles.phrasebookStat}>
            <Text style={styles.phrasebookStatValue}>{recordedCount}</Text>
            <Text style={styles.phrasebookStatLabel}>with audio</Text>
          </View>
        </View>
      </View>

      <View style={[styles.phraseGrid, isWide && styles.phraseGridWide]}>
        {phrases.map((phrase) => {
          const audio = getAudioForKey(phrase.audioKey);
          const isPlaying = playingAudioKey === phrase.audioKey;
          const hasError = audioErrorKey === phrase.audioKey;
          const audioLabel = audio ? (isPlaying ? 'Playing' : 'Play') : 'Audio Soon';

          return (
            <View key={`${phrase.unitLabel}-${phrase.audioKey}`} style={[styles.phraseCard, isWide && styles.phraseCardWide]}>
              <View style={styles.phraseCardHeader}>
                <Text style={styles.phraseCategory}>{phrase.category}</Text>
                <Text style={styles.phraseUnitPill}>{phrase.unitLabel}</Text>
              </View>
              <View style={styles.phraseTop}>
                <View style={styles.phraseCopy}>
                  <Text style={styles.phrase}>{phrase.dholuo}</Text>
                  <Text style={styles.translation}>{phrase.english}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    audio ? `Play recording for ${phrase.dholuo}` : `Audio not recorded yet for ${phrase.dholuo}`
                  }
                  disabled={!audio}
                  onPress={() => playPhraseAudio(phrase.audioKey)}
                  style={[
                    styles.audioButton,
                    audio && styles.audioButtonReady,
                    isPlaying && styles.audioButtonPlaying,
                    hasError && styles.audioButtonError,
                  ]}
                >
                  <Text
                    style={[
                      styles.audioText,
                      audio && styles.audioTextReady,
                      isPlaying && styles.audioTextPlaying,
                      hasError && styles.audioTextError,
                    ]}
                  >
                    {hasError ? 'Try Again' : audioLabel}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.usage}>{phrase.usage}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
function ProfileScreen({
  completedRounds,
  lessonProgress,
  mistakes,
  unit,
  unitProgressById,
  xp,
  streak,
  selectedUnitId,
  onSelectUnit,
}: {
  completedRounds: number;
  lessonProgress: number;
  mistakes: number;
  unit: LearningUnit;
  unitProgressById: Record<string, UnitProgress>;
  xp: number;
  streak: number;
  selectedUnitId: string;
  onSelectUnit: (unitId: string, nextTab?: Tab) => void;
}) {
  const completedUnits = learningUnits.filter((item) => {
    const progress = unitProgressById[item.id];
    return progress?.reviewCompleted && progress.correctExerciseIds.length === item.exercises.length;
  }).length;

  return (
    <View>
      <Text style={styles.kicker}>Profile</Text>
      <Text style={styles.screenTitle}>Your Luo101 rhythm</Text>
      <View style={styles.profileGrid}>
        <MetricCard label="Total XP" value={xp.toString()} />
        <MetricCard label="Streak" value={`${streak} days`} />
        <MetricCard label="Level" value="Beginner 1" />
        <MetricCard label={`${unit.title} Progress`} value={`${Math.round(lessonProgress * 100)}%`} />
        <MetricCard label="Parts Complete" value={`${completedUnits}/${learningUnits.length}`} />
        <MetricCard label="Rounds" value={completedRounds.toString()} />
        <MetricCard label="Misses" value={mistakes.toString()} />
      </View>
      <View style={styles.cultureCard}>
        <Text style={styles.cardLabel}>Supabase Ready</Text>
        <Text style={styles.cultureText}>
          Auth, profiles, progress, review mistakes, lesson content, and audio storage are planned as backend tables and buckets.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Progress Map</Text>
        <Text style={styles.sectionMeta}>{completedUnits}/{learningUnits.length}</Text>
      </View>
      <UnitProgressList
        selectedUnitId={selectedUnitId}
        unitProgressById={unitProgressById}
        onSelectUnit={onSelectUnit}
      />
    </View>
  );
}

function getUnitProgressMeta(unit: LearningUnit, progress?: UnitProgress) {
  const drillsDone = progress?.correctExerciseIds.length ?? 0;
  const percent = unit.exercises.length ? Math.round((drillsDone / unit.exercises.length) * 100) : 0;
  const isPracticeComplete = drillsDone === unit.exercises.length;
  const isComplete = Boolean(progress?.reviewCompleted && isPracticeComplete);
  const status = isComplete ? 'Complete' : drillsDone > 0 || progress?.completedRounds ? 'In progress' : 'Not started';

  return {
    drillsDone,
    isComplete,
    percent,
    status,
  };
}

function UnitSelector({
  compact = false,
  selectedUnitId,
  unitProgressById,
  onSelectUnit,
}: {
  compact?: boolean;
  selectedUnitId: string;
  unitProgressById: Record<string, UnitProgress>;
  onSelectUnit: (unitId: string) => void;
}) {
  return (
    <View style={styles.unitPicker}>
      <View style={styles.sectionHeaderTight}>
        <Text style={styles.sectionTitleSmall}>Choose a Unit</Text>
        <Text style={styles.sectionMeta}>skip anytime</Text>
      </View>
      <ScrollView
        horizontal={compact}
        nestedScrollEnabled
        showsHorizontalScrollIndicator={compact}
        showsVerticalScrollIndicator={!compact}
        style={[styles.unitPickerScroll, compact && styles.unitPickerScrollCompact]}
        contentContainerStyle={[styles.unitPickerGrid, compact && styles.unitPickerRail]}
      >
        {learningUnits.map((item, index) => {
          const progress = unitProgressById[item.id];
          const meta = getUnitProgressMeta(item, progress);
          const isSelected = item.id === selectedUnitId;
          const label = item.unitLabel ?? `Unit ${index + 1}`;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              style={[styles.unitPickerItem, compact && styles.unitPickerItemCompact, isSelected && styles.unitPickerItemActive]}
              onPress={() => onSelectUnit(item.id)}
            >
              <View style={styles.unitPickerTop}>
                <Text style={[styles.unitPickerLabel, isSelected && styles.unitPickerLabelActive]}>{label}</Text>
                <Text style={[styles.unitPickerStatus, meta.isComplete && styles.unitPickerStatusComplete]}>
                  {meta.status}
                </Text>
              </View>
              <Text style={styles.unitPickerTitle}>{item.title}</Text>
              <View style={styles.unitPickerTrack}>
                <View style={[styles.unitPickerFill, { width: `${Math.max(meta.percent, meta.percent > 0 ? 6 : 0)}%` }]} />
              </View>
              <Text style={styles.unitPickerMeta}>
                {meta.drillsDone}/{item.exercises.length} drills
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function UnitProgressList({
  selectedUnitId,
  unitProgressById,
  onSelectUnit,
}: {
  selectedUnitId: string;
  unitProgressById: Record<string, UnitProgress>;
  onSelectUnit: (unitId: string, nextTab?: Tab) => void;
}) {
  return (
    <View style={styles.progressList}>
      {learningUnits.map((item, index) => {
        const progress = unitProgressById[item.id];
        const meta = getUnitProgressMeta(item, progress);
        const isSelected = item.id === selectedUnitId;
        const label = item.unitLabel ?? `Unit ${index + 1}`;

        return (
          <View key={`progress-${item.id}`} style={[styles.progressUnitCard, isSelected && styles.progressUnitCardActive]}>
            <View style={styles.progressUnitHeader}>
              <View style={styles.progressUnitCopy}>
                <Text style={styles.cardLabel}>{label}</Text>
                <Text style={styles.progressUnitTitle}>{item.title}</Text>
                <Text style={styles.progressUnitSubtitle}>{item.subtitle}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={[styles.jumpButton, isSelected && styles.jumpButtonActive]}
                onPress={() => onSelectUnit(item.id, 'learn')}
              >
                <Text style={[styles.jumpButtonText, isSelected && styles.jumpButtonTextActive]}>
                  {isSelected ? 'Current' : 'Jump'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.progressUnitTrack}>
              <View style={[styles.progressUnitFill, { width: `${meta.percent}%` }]} />
            </View>
            <View style={styles.progressUnitStats}>
              <Text style={styles.progressUnitStat}>{meta.percent}%</Text>
              <Text style={styles.progressUnitStat}>{meta.drillsDone}/{item.exercises.length} drills</Text>
              <Text style={styles.progressUnitStat}>{progress?.completedRounds ?? 0} rounds</Text>
              <Text style={styles.progressUnitStat}>{progress?.mistakes ?? 0} misses</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function NavButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.navButton, active && styles.navButtonActive]} onPress={onPress}>
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#F7FAF6',
  },
  topBar: {
    backgroundColor: '#F7FAF6',
    borderBottomColor: '#DDE8D8',
    borderBottomWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  topBarInner: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 1180,
    width: '100%',
  },
  brand: {
    color: '#10251B',
    fontSize: 28,
    fontWeight: '900',
  },
  brandSub: {
    color: '#5D6D65',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statValue: {
    color: '#0E6B4F',
    fontSize: 16,
    fontWeight: '900',
  },
  statLabel: {
    color: '#6E7C75',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    alignSelf: 'center',
    maxWidth: 1180,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 116,
    width: '100%',
  },
  learnPage: {
    gap: 12,
  },
  hero: {
    backgroundColor: '#0E6B4F',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: 20,
  },
  heroCompact: {
    alignItems: 'flex-start',
    gap: 10,
    padding: 16,
  },
  heroCopy: {
    flex: 1,
  },
  heroTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroToplineCompact: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  kicker: {
    color: '#C1562E',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  kickerOnDark: {
    color: '#F1C84B',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  heroPill: {
    backgroundColor: '#F7FAF6',
    borderRadius: 8,
    color: '#0E6B4F',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
  },
  heroTitleCompact: {
    fontSize: 28,
    lineHeight: 33,
  },
  heroText: {
    color: '#D9F5E9',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 4,
  },
  heroTextCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroMission: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(241, 200, 75, 0.38)',
    borderRadius: 8,
    borderWidth: 1,
    color: '#FFF6D3',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroMissionCompact: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  heroGoal: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: 12,
    opacity: 0.9,
  },
  heroGoalCompact: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  progressTrack: {
    backgroundColor: '#0A503C',
    borderRadius: 8,
    height: 12,
    marginTop: 18,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: '#F1C84B',
    height: '100%',
  },
  heroProgressText: {
    color: '#D9F5E9',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  mascotMark: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#F1C84B',
    borderColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 3,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  mascotMarkCompact: {
    borderWidth: 2,
    height: 58,
    width: 58,
  },
  mascotTop: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '900',
  },
  mascotBottom: {
    color: '#C1562E',
    fontSize: 28,
    fontWeight: '900',
  },
  learnGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  learnGridCompact: {
    gap: 8,
  },
  learnMetric: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 70,
    padding: 10,
  },
  learnMetricValue: {
    color: '#0E6B4F',
    fontSize: 24,
    fontWeight: '900',
  },
  learnMetricLabel: {
    color: '#6E7C75',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 4,
    textTransform: 'uppercase',
  },
  unitPicker: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  sectionHeaderTight: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleSmall: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '900',
  },
  unitPickerScroll: {
    maxHeight: 356,
    paddingBottom: 4,
  },
  unitPickerScrollCompact: {
    maxHeight: 148,
    paddingBottom: 8,
  },
  unitPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  unitPickerRail: {
    flexWrap: 'nowrap',
    paddingRight: 8,
  },
  unitPickerItem: {
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 156,
    padding: 12,
    width: '48%',
  },
  unitPickerItemCompact: {
    minHeight: 128,
    width: 172,
  },
  unitPickerItemActive: {
    backgroundColor: '#E4F2EE',
    borderColor: '#0E6B4F',
    borderWidth: 2,
  },
  unitPickerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  unitPickerLabel: {
    color: '#C1562E',
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  unitPickerLabelActive: {
    color: '#0E6B4F',
  },
  unitPickerStatus: {
    color: '#6E7C75',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  unitPickerStatusComplete: {
    color: '#0E6B4F',
  },
  unitPickerTitle: {
    color: '#10251B',
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
    marginTop: 6,
  },
  unitPickerTrack: {
    backgroundColor: '#DFE8E1',
    borderRadius: 8,
    height: 8,
    marginTop: 10,
    overflow: 'hidden',
  },
  unitPickerFill: {
    backgroundColor: '#F1C84B',
    height: '100%',
  },
  unitPickerMeta: {
    color: '#5D6D65',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 7,
    textTransform: 'uppercase',
  },
  nextCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    padding: 16,
  },
  nextCardCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
    padding: 14,
  },
  nextCopy: {
    flex: 1,
  },
  nextTitle: {
    color: '#10251B',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 24,
  },
  nextText: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 4,
  },
  phraseChip: {
    backgroundColor: '#F1C84B',
    borderColor: '#C1562E',
    borderRadius: 8,
    borderWidth: 2,
    maxWidth: 156,
    minHeight: 72,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  phraseChipCompact: {
    maxWidth: '100%',
    minHeight: 62,
  },
  phraseChipText: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '900',
  },
  phraseChipSub: {
    color: '#5F4320',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
    marginTop: 3,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  sectionHeaderCompact: {
    marginTop: 8,
  },
  sectionTitle: {
    color: '#10251B',
    fontSize: 22,
    fontWeight: '900',
  },
  sectionTitleCompact: {
    fontSize: 19,
  },
  sectionMeta: {
    color: '#0E6B4F',
    fontSize: 13,
    fontWeight: '900',
  },
  path: {
    marginTop: 14,
  },
  pathItem: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
    padding: 12,
  },
  pathItemActive: {
    borderColor: '#C1562E',
    borderWidth: 2,
  },
  pathItemComplete: {
    backgroundColor: '#F4FBF7',
  },
  pathItemCompact: {
    alignItems: 'flex-start',
    gap: 10,
    padding: 10,
  },
  pathDot: {
    alignItems: 'center',
    backgroundColor: '#DFE8E1',
    borderRadius: 8,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  pathDotCompact: {
    height: 42,
    width: 42,
  },
  pathDotComplete: {
    backgroundColor: '#0E6B4F',
  },
  pathDotActive: {
    backgroundColor: '#F1C84B',
    borderColor: '#C1562E',
    borderWidth: 2,
  },
  pathDotText: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '900',
  },
  pathCopy: {
    flex: 1,
  },
  pathTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  pathTitleRowCompact: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  pathTitle: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '900',
  },
  pathTitleCompact: {
    flexBasis: '100%',
  },
  pathState: {
    color: '#6E7C75',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  pathStateActive: {
    color: '#C1562E',
  },
  pathStateComplete: {
    color: '#0E6B4F',
  },
  pathDetail: {
    color: '#5D6D65',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 5,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#C1562E',
    borderRadius: 8,
    marginTop: 18,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: {
    backgroundColor: '#AEBAB3',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#C1562E',
    borderRadius: 8,
    borderWidth: 2,
    marginTop: 12,
    minHeight: 46,
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#C1562E',
    fontSize: 15,
    fontWeight: '900',
  },
  cultureCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  learnBottomGrid: {
    gap: 12,
  },
  learnBottomGridCompact: {
    gap: 8,
  },
  cardLabel: {
    color: '#0E6B4F',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  cultureText: {
    color: '#40514A',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  dialoguePreview: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 24,
  },
  lessonHero: {
    backgroundColor: '#10251B',
    borderRadius: 8,
    padding: 20,
  },
  lessonHeroTitle: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  lessonHeroText: {
    color: '#D9F5E9',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
  },
  teachSteps: {
    gap: 12,
    marginTop: 14,
  },
  teachCard: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  teachNumber: {
    alignItems: 'center',
    backgroundColor: '#F1C84B',
    borderColor: '#C1562E',
    borderRadius: 8,
    borderWidth: 2,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  teachNumberText: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '900',
  },
  teachCopy: {
    flex: 1,
  },
  teachFocus: {
    color: '#10251B',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  teachTranslation: {
    color: '#0E6B4F',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  teachDetail: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: 8,
  },
  exampleStrip: {
    backgroundColor: '#F7FAF6',
    borderLeftColor: '#0E6B4F',
    borderLeftWidth: 4,
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  exampleText: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '900',
  },
  patternCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  patternRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  patternStep: {
    backgroundColor: '#E4F2EE',
    borderRadius: 8,
    color: '#0E6B4F',
    fontSize: 13,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  patternArrow: {
    color: '#C1562E',
    fontSize: 18,
    fontWeight: '900',
    paddingTop: 4,
  },
  patternLine: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 26,
    marginTop: 14,
  },
  dictionarySearchCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  dictionaryInput: {
    backgroundColor: '#F7FAF6',
    borderColor: '#C9D8D0',
    borderRadius: 8,
    borderWidth: 1,
    color: '#10251B',
    fontSize: 15,
    fontWeight: '700',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  dictionaryStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  dictionaryStat: {
    backgroundColor: '#F7FAF6',
    borderColor: '#E4ECE7',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  dictionaryStatValue: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  dictionaryStatLabel: {
    color: '#5D6D65',
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 14,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  dictionaryFilterLabel: {
    color: '#10251B',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 14,
    textTransform: 'uppercase',
  },
  dictionaryLetters: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  dictionaryLetter: {
    alignItems: 'center',
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 38,
    minWidth: 42,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  dictionaryLetterActive: {
    backgroundColor: '#0E6B4F',
    borderColor: '#0E6B4F',
  },
  dictionaryLetterText: {
    color: '#40514A',
    fontSize: 13,
    fontWeight: '900',
  },
  dictionaryLetterTextActive: {
    color: '#FFFFFF',
  },
  dictionaryCategories: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  dictionaryCategoryChip: {
    alignItems: 'center',
    backgroundColor: '#FFF8E2',
    borderColor: '#EADCA8',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  dictionaryCategoryChipActive: {
    backgroundColor: '#C1562E',
    borderColor: '#C1562E',
  },
  dictionaryCategoryText: {
    color: '#6B4E16',
    fontSize: 12,
    fontWeight: '900',
  },
  dictionaryCategoryTextActive: {
    color: '#FFFFFF',
  },
  dictionaryActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dictionaryMeta: {
    color: '#5D6D65',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  dictionaryClearButton: {
    alignItems: 'center',
    backgroundColor: '#10251B',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: 14,
  },
  dictionaryClearText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dictionaryNotice: {
    backgroundColor: '#10251B',
    borderRadius: 8,
    marginTop: 12,
    padding: 14,
  },
  dictionaryNoticeTitle: {
    color: '#F1C84B',
    fontSize: 16,
    fontWeight: '900',
  },
  dictionaryNoticeText: {
    color: '#F7FAF6',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 5,
  },
  dictionaryResults: {
    gap: 10,
    marginTop: 12,
  },
  dictionaryCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  dictionaryCardTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  dictionaryWord: {
    color: '#10251B',
    flex: 1,
    fontSize: 21,
    fontWeight: '900',
    lineHeight: 27,
  },
  dictionaryCategory: {
    backgroundColor: '#E4F2EE',
    borderRadius: 8,
    color: '#0E6B4F',
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '900',
    maxWidth: 160,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  dictionaryMeaning: {
    color: '#C1562E',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 22,
    marginTop: 5,
  },
  dictionaryNoteBlock: {
    borderTopColor: '#EEF3EF',
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 8,
  },
  dictionaryNoteLabel: {
    color: '#7A8A82',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dictionaryNote: {
    color: '#40514A',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 4,
  },
  dictionaryEmpty: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  dictionaryEmptyTitle: {
    color: '#10251B',
    fontSize: 20,
    fontWeight: '900',
  },
  dictionaryEmptyText: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 12,
    marginTop: 5,
  },
  readingSection: {
    marginTop: 8,
  },
  readingCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E1DB',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  readingTopline: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  readingCount: {
    color: '#6E7C75',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  readingTitle: {
    color: '#10251B',
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 31,
  },
  readingEnglishTitle: {
    color: '#C1562E',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  readingIntroduction: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 10,
  },
  readingLines: {
    borderTopColor: '#E4ECE7',
    borderTopWidth: 1,
    marginTop: 14,
  },
  readingLine: {
    alignItems: 'flex-start',
    borderBottomColor: '#E4ECE7',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 11,
  },
  readingLineNumber: {
    color: '#0E6B4F',
    fontSize: 12,
    fontWeight: '900',
    paddingTop: 3,
    width: 18,
  },
  readingLineCopy: {
    flex: 1,
  },
  readingDholuo: {
    color: '#10251B',
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 24,
  },
  readingEnglish: {
    color: '#5D6D65',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 3,
  },
  readingRevealButton: {
    alignItems: 'center',
    borderColor: '#0E6B4F',
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 44,
  },
  readingRevealText: {
    color: '#0E6B4F',
    fontSize: 14,
    fontWeight: '900',
  },
  readingVocabulary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  readingWord: {
    backgroundColor: '#F7FAF6',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  readingWordDholuo: {
    color: '#10251B',
    fontSize: 13,
    fontWeight: '900',
  },
  readingWordEnglish: {
    color: '#6E7C75',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  guidedDialogueCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    padding: 16,
  },
  guidedDialogueLine: {
    borderTopColor: '#E8EFEA',
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  reviewHero: {
    backgroundColor: '#0E6B4F',
    borderRadius: 8,
    padding: 20,
  },
  reviewGrid: {
    gap: 10,
    marginTop: 14,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  reviewPhrase: {
    color: '#10251B',
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  reviewTranslation: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 4,
  },
  reviewFooterCard: {
    backgroundColor: '#10251B',
    borderRadius: 8,
    marginTop: 14,
    padding: 16,
  },
  reviewFooterTitle: {
    color: '#F1C84B',
    fontSize: 20,
    fontWeight: '900',
  },
  reviewFooterText: {
    color: '#F7FAF6',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 6,
  },
  completeCard: {
    backgroundColor: '#10251B',
    borderRadius: 8,
    marginTop: 18,
    padding: 16,
  },
  completeTitle: {
    color: '#F1C84B',
    fontSize: 22,
    fontWeight: '900',
  },
  completeText: {
    color: '#F7FAF6',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 6,
  },
  completeStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  practiceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exerciseCount: {
    color: '#6E7C75',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  prompt: {
    color: '#10251B',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    marginBottom: 18,
  },
  optionGrid: {
    gap: 10,
  },
  option: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 2,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  optionSelected: {
    borderColor: '#0E6B4F',
  },
  optionCorrect: {
    backgroundColor: '#DFF6EA',
  },
  optionWrong: {
    backgroundColor: '#FBE4DA',
    borderColor: '#C1562E',
  },
  optionText: {
    color: '#10251B',
    fontSize: 17,
    fontWeight: '800',
  },
  answerTray: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 2,
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  answerText: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '900',
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  tile: {
    backgroundColor: '#F1C84B',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  tileText: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '900',
  },
  feedback: {
    borderRadius: 8,
    marginTop: 18,
    padding: 14,
  },
  feedbackGood: {
    backgroundColor: '#DFF6EA',
  },
  feedbackBad: {
    backgroundColor: '#FBE4DA',
  },
  feedbackTitle: {
    color: '#10251B',
    fontSize: 16,
    fontWeight: '900',
  },
  feedbackText: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 4,
  },
  dialogue: {
    marginTop: 22,
  },
  dialogueLine: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  dialogueSpeaker: {
    color: '#C1562E',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  dialogueText: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  dialogueTranslation: {
    color: '#6E7C75',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  screenTitle: {
    color: '#10251B',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    marginBottom: 16,
  },
  phrasebookPage: {
    gap: 16,
  },
  phrasebookHero: {
    alignItems: 'stretch',
    backgroundColor: '#10251B',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'space-between',
    padding: 22,
  },
  phrasebookHeroCompact: {
    flexDirection: 'column',
    padding: 18,
  },
  phrasebookHeroCopy: {
    flex: 1,
  },
  phrasebookTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
    marginTop: 6,
  },
  phrasebookIntro: {
    color: '#D9F5E9',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 720,
  },
  phrasebookStats: {
    flexDirection: 'row',
    gap: 10,
  },
  phrasebookStatsCompact: {
    flexWrap: 'wrap',
  },
  phrasebookStat: {
    alignItems: 'center',
    backgroundColor: '#F7FAF6',
    borderColor: '#F1C84B',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  phrasebookStatValue: {
    color: '#0E6B4F',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  phrasebookStatLabel: {
    color: '#40514A',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  phraseGrid: {
    gap: 14,
  },
  phraseGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },  phraseCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 194,
    padding: 18,
  },
  phraseCardWide: {
    flexBasis: '48.7%',
    flexGrow: 1,
  },
  phraseCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  phraseCategory: {
    color: '#C1562E',
    flexShrink: 0,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  phraseUnitPill: {
    backgroundColor: '#E4F2EE',
    borderRadius: 8,
    color: '#0E6B4F',
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '900',
    lineHeight: 14,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
    textTransform: 'uppercase',
  },
  phraseTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  phraseCopy: {
    flex: 1,
  },
  phrase: {
    color: '#10251B',
    fontSize: 22,
    fontWeight: '900',
  },
  translation: {
    color: '#6E7C75',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  audioButton: {
    alignItems: 'center',
    backgroundColor: '#E4F2EE',
    borderRadius: 8,
    minHeight: 42,
    justifyContent: 'center',
    minWidth: 92,
    paddingHorizontal: 12,
  },
  audioButtonReady: {
    backgroundColor: '#0E6B4F',
  },
  audioButtonPlaying: {
    backgroundColor: '#F1C84B',
  },
  audioButtonError: {
    backgroundColor: '#FBE4DA',
    borderColor: '#C1562E',
    borderWidth: 1,
  },
  audioText: {
    color: '#0E6B4F',
    fontSize: 13,
    fontWeight: '900',
  },
  audioTextReady: {
    color: '#FFFFFF',
  },
  audioTextPlaying: {
    color: '#10251B',
  },
  audioTextError: {
    color: '#C1562E',
  },
  usage: {
    color: '#40514A',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 10,
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 92,
    padding: 14,
    width: '47%',
  },
  metricValue: {
    color: '#0E6B4F',
    fontSize: 22,
    fontWeight: '900',
  },
  metricLabel: {
    color: '#6E7C75',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
    textTransform: 'uppercase',
  },
  progressList: {
    gap: 12,
    marginTop: 14,
  },
  progressUnitCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DDE8D8',
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  progressUnitCardActive: {
    borderColor: '#0E6B4F',
    borderWidth: 2,
  },
  progressUnitHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  progressUnitCopy: {
    flex: 1,
  },
  progressUnitTitle: {
    color: '#10251B',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
  },
  progressUnitSubtitle: {
    color: '#5D6D65',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 3,
  },
  jumpButton: {
    alignItems: 'center',
    borderColor: '#C1562E',
    borderRadius: 8,
    borderWidth: 2,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  jumpButtonActive: {
    backgroundColor: '#0E6B4F',
    borderColor: '#0E6B4F',
  },
  jumpButtonText: {
    color: '#C1562E',
    fontSize: 13,
    fontWeight: '900',
  },
  jumpButtonTextActive: {
    color: '#FFFFFF',
  },
  progressUnitTrack: {
    backgroundColor: '#DFE8E1',
    borderRadius: 8,
    height: 10,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressUnitFill: {
    backgroundColor: '#0E6B4F',
    height: '100%',
  },
  progressUnitStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  progressUnitStat: {
    backgroundColor: '#F7FAF6',
    borderRadius: 8,
    color: '#40514A',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 6,
    textTransform: 'uppercase',
  },
  nav: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopColor: '#DDE8D8',
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    position: 'absolute',
    right: 0,
  },
  navButton: {
    alignItems: 'center',
    borderRadius: 8,
    flexBasis: 0,
    flexGrow: 1,
    maxWidth: 220,
    minHeight: 48,
    justifyContent: 'center',
  },
  navButtonActive: {
    backgroundColor: '#0E6B4F',
  },
  navText: {
    color: '#6E7C75',
    fontSize: 12,
    fontWeight: '900',
  },
  navTextActive: {
    color: '#FFFFFF',
  },
});

