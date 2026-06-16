import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Tabs,
    Tab,
    TextField,
    Typography,
    Select,
    MenuItem,
    Stack,
} from '@mui/material';
import { Question, QuestionType, Rule, RuleType } from '../types/quiz';
import { isContentEmpty } from '../utils/contentUtils';
import { embedExternalImages } from '../utils/embedImages';
import { useTranslation } from '../i18n/LanguageContext';
import RuleForm from './RuleForm';
import FindACatEditor from './FindACatEditor';
import ChoiceOptionsEditor from './ChoiceOptionsEditor';
import ProgressiveRevealEditor from './ProgressiveRevealEditor';
import KaraokeEditor from './KaraokeEditor';


interface QuestionModalProps {
    open: boolean;
    question: Question | null;
    questionIndex: number;
    onSave: (question: Question) => void;
    onClose: () => void;
}

const DEFAULT_FIND_A_CAT_TASK = 'Знайдіть всіх котиків, всього %total%, залишилось: %left%';
const LAST_FIND_A_CAT_TASK_KEY = 'packer:last-find-a-cat-task';

// The last saved task text becomes the default for the next find-a-cat question
const getDefaultFindACatTask = (): string => {
    try {
        return localStorage.getItem(LAST_FIND_A_CAT_TASK_KEY) || DEFAULT_FIND_A_CAT_TASK;
    } catch {
        return DEFAULT_FIND_A_CAT_TASK;
    }
};

const rememberFindACatTask = (task: string) => {
    try {
        if (task.trim()) {
            localStorage.setItem(LAST_FIND_A_CAT_TASK_KEY, task);
        }
    } catch {
        // localStorage unavailable (private mode etc.) — defaults just won't persist
    }
};

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
    return (
        <div role="tabpanel" hidden={value !== index}>
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
};

const QuestionModal: React.FC<QuestionModalProps> = ({
    open,
    question,
    questionIndex,
    onSave,
    onClose,
}) => {
    const { t } = useTranslation();
    const [tabValue, setTabValue] = useState(0);
    const [formData, setFormData] = useState<Partial<Question>>({
        id: 0,
        type: QuestionType.Normal,
        price: {
            text: '100',
            correct: 100,
            incorrect: -100,
            random_range: 'null',
        },
        rules: [],
        after_round: [],
        task: '',
        image: '',
        map: [],
        duration: 60,
        max_clicks: 0,
        first_place_bonus: 100,
        perfect_bonus: 500,
        multiple: false,
        options: [],
        effect: 'blur',
        curve: 'linear',
        media: '',
        lyrics: '',
        lyrics_format: 'plain',
        crocodile_mode: 'fastest',
        vote_mode: 'open',
    });

    const [draftRule, setDraftRule] = useState<Partial<Rule>>({
        type: RuleType.Embedded,
        content: '',
        duration: 15,
    });
    const [draftAfterRound, setDraftAfterRound] = useState<Partial<Rule>>({
        type: RuleType.Embedded,
        content: '',
        duration: 15,
    });
    const [incorrectInputValue, setIncorrectInputValue] = useState<string>('-100');
    const [correctInputValue, setCorrectInputValue] = useState<string>('100');
    const [answerInputValue, setAnswerInputValue] = useState<string>('');

    useEffect(() => {
        if (question) {
            // Legacy packs store only the target name ("котиків"); rebuild the
            // exact task text the game showed for them so resaving keeps it
            const needsTaskMigration =
                question.type === QuestionType.FindACat && !question.task && question.name;
            setFormData(needsTaskMigration
                ? {
                    ...question,
                    task: `Знайдіть і клікніть на всіх ${question.name}. Залишилось всього %left%`,
                    name: undefined,
                }
                : question);
            setIncorrectInputValue(question.price?.incorrect?.toString() || '0');
            setCorrectInputValue(question.price?.correct?.toString() || '0');
            setAnswerInputValue(question.answer !== undefined ? question.answer.toString() : '');
        } else {
            // New question - set default price based on index
            const defaultPrice = (questionIndex + 1) * 100;
            setFormData({
                id: Date.now(),
                type: QuestionType.Normal,
                price: {
                    text: defaultPrice.toString(),
                    correct: defaultPrice,
                    incorrect: -defaultPrice,
                    random_range: 'null',
                },
                rules: [],
                after_round: [],
                task: getDefaultFindACatTask(),
                image: '',
                map: [],
                duration: 60,
                max_clicks: 0,
                first_place_bonus: 100,
                perfect_bonus: 500,
                multiple: false,
                options: [],
                effect: 'blur',
                media: '',
                lyrics: '',
                lyrics_format: 'plain',
                crocodile_mode: 'fastest',
                vote_mode: 'open',
            });
            setIncorrectInputValue((-defaultPrice).toString());
            setCorrectInputValue(defaultPrice.toString());
            setAnswerInputValue('');
        }
        setTabValue(0);

        // Reset drafts
        setDraftRule({
            type: RuleType.Embedded,
            content: '',
            duration: 15,
        });
        setDraftAfterRound({
            type: RuleType.Embedded,
            content: '',
            duration: 15,
        });
    }, [question, questionIndex, open]);

    function convertMediaTags(htmlString: string): string {
        const checkLength = Math.min(200, htmlString.length);
        const prefix = htmlString.substring(0, checkLength);

        if (prefix.includes('<img src="data:video')) {
            return htmlString.replace('<img', '<video controls autoplay');
        } else if (prefix.includes('<img src="data:audio')) {
            return htmlString.replace('<img', '<audio controls autoplay');
        } else {
            return htmlString;
        }
    }

    const isFindACat = formData.type === QuestionType.FindACat;
    const isCloseEnough = formData.type === QuestionType.CloseEnough;
    const isChoice = formData.type === QuestionType.Choice;
    const isTextAnswer = formData.type === QuestionType.TextAnswer;
    const isProgressiveReveal = formData.type === QuestionType.ProgressiveReveal;
    const isKaraoke = formData.type === QuestionType.Karaoke;
    const isCrocodile = formData.type === QuestionType.Crocodile;
    const isVoting = formData.type === QuestionType.Voting;

    const isFindACatValid = !isFindACat || (
        !!formData.task?.trim() &&
        !!formData.image &&
        Array.isArray(formData.map) &&
        formData.map.length > 0
    );

    const isCloseEnoughValid = !isCloseEnough || Number.isFinite(parseFloat(answerInputValue));

    const choiceCorrectCount = (formData.options || []).filter(o => o.correct).length;
    const isChoiceValid = !isChoice || (
        (formData.options || []).length >= 2 &&
        (formData.multiple ? choiceCorrectCount >= 1 : choiceCorrectCount === 1)
    );

    const isProgressiveRevealValid = !isProgressiveReveal || !!formData.image;

    const isKaraokeValid = !isKaraoke || !!formData.media;

    const getValidationErrorMessage = () => {
        if (isCloseEnough && !isCloseEnoughValid) {
            return t('validation.closeEnough');
        }
        if (isKaraoke && !isKaraokeValid) {
            return t('validation.karaokeMedia');
        }
        if (isChoice && !isChoiceValid) {
            if ((formData.options || []).length < 2) {
                return t('validation.minTwoOptions');
            }
            return formData.multiple
                ? t('validation.atLeastOneCorrect')
                : t('validation.exactlyOneCorrect');
        }
        if (isProgressiveReveal && !isProgressiveRevealValid) {
            return t('validation.uploadImage');
        }
        if (!isFindACat) return null;
        const missing = [];
        if (!formData.task?.trim()) missing.push(t('validation.missingTask'));
        if (!formData.image) missing.push(t('validation.missingImage'));
        if (!formData.map || formData.map.length === 0) missing.push(t('validation.missingArea'));

        if (missing.length > 0) {
            return t('validation.addMissing', { items: missing.join(', ') });
        }
        return null;
    };

    const handleSave = async () => {
        let updatedQuestion: Question;

        const defaultPriceValue = {
            text: '100',
            correct: 100,
            incorrect: -100,
            random_range: 'null',
        };

        // Auto-save drafts if they have content (used by all rule-based types)
        let currentRules = [...(formData.rules || [])];
        if (!isContentEmpty(draftRule.content)) {
            const ruleToAdd = {
                ...draftRule,
                content: convertMediaTags(await embedExternalImages(draftRule.content!)),
            } as Rule;
            currentRules.push(ruleToAdd);
        }

        let currentAfterRound = [...(formData.after_round || [])];
        if (!isContentEmpty(draftAfterRound.content)) {
            const ruleToAdd = {
                ...draftAfterRound,
                content: convertMediaTags(await embedExternalImages(draftAfterRound.content!)),
            } as Rule;
            currentAfterRound.push(ruleToAdd);
        }

        if (formData.type === QuestionType.FindACat) {
            updatedQuestion = {
                ...formData,
                id: formData.id || Date.now(),
                type: QuestionType.FindACat,
                price: formData.price || defaultPriceValue,
                task: formData.task || '',
                name: undefined,
                image: formData.image || '',
                map: formData.map || [],
                duration: formData.duration || 60,
                max_clicks: formData.max_clicks || undefined,
                first_place_bonus: formData.first_place_bonus || undefined,
                rules: [],
                after_round: [],
                multiple: undefined,
                options: undefined,
                effect: undefined,
                curve: undefined,
                media: undefined,
                lyrics: undefined,
                lyrics_format: undefined,
            } as Question;
        } else if (formData.type === QuestionType.ProgressiveReveal) {
            updatedQuestion = {
                ...formData,
                id: formData.id || Date.now(),
                type: QuestionType.ProgressiveReveal,
                price: formData.price || defaultPriceValue,
                image: formData.image || '',
                duration: formData.duration || 60,
                effect: formData.effect || 'blur',
                curve: formData.curve || 'linear',
                rules: [],
                after_round: currentAfterRound,
                task: undefined,
                name: undefined,
                map: undefined,
                answer: undefined,
                max_clicks: undefined,
                first_place_bonus: undefined,
                perfect_bonus: undefined,
                multiple: undefined,
                options: undefined,
                media: undefined,
                lyrics: undefined,
                lyrics_format: undefined,
            } as Question;
        } else if (formData.type === QuestionType.Karaoke) {
            updatedQuestion = {
                ...formData,
                id: formData.id || Date.now(),
                type: QuestionType.Karaoke,
                price: formData.price || defaultPriceValue,
                media: formData.media || '',
                lyrics: formData.lyrics || '',
                lyrics_format: formData.lyrics_format || 'plain',
                rules: [],
                after_round: currentAfterRound,
                task: undefined,
                name: undefined,
                image: undefined,
                map: undefined,
                answer: undefined,
                duration: undefined,
                max_clicks: undefined,
                first_place_bonus: undefined,
                perfect_bonus: undefined,
                multiple: undefined,
                options: undefined,
                effect: undefined,
                curve: undefined,
            } as Question;
        } else if (formData.type === QuestionType.Crocodile) {
            // Crocodile shows the prompt only to the chosen performer; there is no
            // pre-authored answer (the performer creates it live), so after_round
            // stays empty. The mode decides how the rest of the table scores.
            updatedQuestion = {
                ...formData,
                id: formData.id || Date.now(),
                type: QuestionType.Crocodile,
                price: formData.price || defaultPriceValue,
                rules: currentRules,
                after_round: [],
                duration: formData.duration || 30,
                crocodile_mode: formData.crocodile_mode || 'fastest',
                task: undefined,
                name: undefined,
                image: undefined,
                map: undefined,
                answer: undefined,
                perfect_bonus: undefined,
                max_clicks: undefined,
                first_place_bonus: undefined,
                multiple: undefined,
                options: undefined,
                effect: undefined,
                curve: undefined,
                media: undefined,
                lyrics: undefined,
                lyrics_format: undefined,
            } as Question;
        } else if (formData.type === QuestionType.Voting) {
            // Voting shows the prompt to everyone, collects an answer from each
            // player, then runs a vote. The authored answer (after_round) stays
            // empty — the players' answers are the content. vote_mode decides
            // whether tallies are visible live.
            updatedQuestion = {
                ...formData,
                id: formData.id || Date.now(),
                type: QuestionType.Voting,
                price: formData.price || defaultPriceValue,
                rules: currentRules,
                after_round: [],
                duration: formData.duration || 60,
                vote_mode: formData.vote_mode || 'open',
                task: undefined,
                name: undefined,
                image: undefined,
                map: undefined,
                answer: undefined,
                perfect_bonus: undefined,
                max_clicks: undefined,
                first_place_bonus: undefined,
                multiple: undefined,
                options: undefined,
                effect: undefined,
                curve: undefined,
                media: undefined,
                lyrics: undefined,
                lyrics_format: undefined,
                crocodile_mode: undefined,
            } as Question;
        } else {
            updatedQuestion = {
                ...formData,
                id: formData.id || Date.now(),
                type: formData.type || QuestionType.Normal,
                price: formData.price || defaultPriceValue,
                rules: currentRules,
                after_round: currentAfterRound,
                task: undefined,
                name: undefined,
                image: undefined,
                map: undefined,
                // Close-enough keeps a numeric answer and an explicit submission window
                answer: isCloseEnough ? parseFloat(answerInputValue) : undefined,
                // Close-enough's submission window
                duration: isCloseEnough ? (formData.duration || 30) : undefined,
                perfect_bonus: isCloseEnough ? (formData.perfect_bonus || undefined) : undefined,
                // Choice keeps its options and single/multiple mode
                multiple: isChoice ? !!formData.multiple : undefined,
                options: isChoice ? (formData.options || []) : undefined,
                max_clicks: undefined,
                // Choice/text can reward the fastest (correct) answerer extra
                first_place_bonus: (isChoice || isTextAnswer) ? (formData.first_place_bonus || undefined) : undefined,
                effect: undefined,
                curve: undefined,
                media: undefined,
                lyrics: undefined,
                lyrics_format: undefined,
            } as Question;
        }

        if (updatedQuestion.type === QuestionType.FindACat) {
            rememberFindACatTask(updatedQuestion.task || '');
        }

        onSave(updatedQuestion);
        onClose();
    };

    const handleRulesChange = (rules: Rule[]) => {
        setFormData({ ...formData, rules });
    };

    const handleAfterRoundChange = (rules: Rule[]) => {
        setFormData({ ...formData, after_round: rules });
    };

    const renderPriceFields = () => (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
                label={t('question.correctPoints')}
                type="number"
                value={correctInputValue}
                onChange={(e) => {
                    const val = e.target.value;
                    setCorrectInputValue(val);
                    const parsed = parseInt(val);
                    if (!isNaN(parsed)) {
                        setFormData({
                            ...formData,
                            price: {
                                ...formData.price!,
                                correct: parsed,
                                text: val,
                                incorrect: -parsed
                            },
                        });
                        setIncorrectInputValue((-parsed).toString());
                    }
                }}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                fullWidth
            />
            <TextField
                label={t('question.priceText')}
                value={formData.price?.text || ''}
                onChange={(e) =>
                    setFormData({
                        ...formData,
                        price: { ...formData.price!, text: e.target.value },
                    })
                }
                fullWidth
            />
            <TextField
                label={t('question.incorrectPoints')}
                type="number"
                value={incorrectInputValue}
                onChange={(e) => {
                    const val = e.target.value;
                    setIncorrectInputValue(val);
                    const parsed = parseInt(val);
                    if (!isNaN(parsed)) {
                        setFormData({
                            ...formData,
                            price: { ...formData.price!, incorrect: parsed },
                        });
                    }
                }}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                fullWidth
            />
            {(isChoice || isTextAnswer) && (
                <TextField
                    label={t('question.firstPlaceBonus')}
                    type="number"
                    value={formData.first_place_bonus || 0}
                    onChange={(e) => setFormData(prev => ({
                        ...prev,
                        first_place_bonus: Math.max(0, parseInt(e.target.value) || 0),
                    }))}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    inputProps={{ min: 0 }}
                    helperText={isChoice
                        ? t('question.firstPlaceBonusHelperChoice')
                        : t('question.firstPlaceBonusHelperText')}
                    fullWidth
                />
            )}
        </Box>
    );



    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: {
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid var(--glass-border)',
                },
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h6" className="gradient-text">
                    {question ? t('question.editTitle') : t('question.newTitle')} - {formData.price?.text || '100'} {t('question.points')}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>{t('question.typeLabel')}</Typography>
                    <Select
                        value={formData.type || QuestionType.Normal}
                        onChange={(e) => {
                            const newType = e.target.value as QuestionType;
                            setFormData((prev) => ({
                                ...prev,
                                type: newType,
                                // Pre-fill find-a-cat with the remembered task text
                                task: newType === QuestionType.FindACat && !prev.task?.trim()
                                    ? getDefaultFindACatTask()
                                    : prev.task,
                            }));
                            setTabValue(0);
                        }}
                        size="small"
                        sx={{
                            height: '36px',
                            minWidth: '130px',
                            background: 'var(--input-bg)',
                            border: '1px solid var(--glass-border)',
                            '& .MuiOutlinedInput-notchedOutline': {
                                border: 'none'
                            }
                        }}
                    >
                        <MenuItem value={QuestionType.Normal}>{t('questionType.normal')}</MenuItem>
                        <MenuItem value={QuestionType.Secret}>{t('questionType.secret')}</MenuItem>
                        <MenuItem value={QuestionType.Empty}>{t('questionType.empty')}</MenuItem>
                        <MenuItem value={QuestionType.FindACat}>{t('questionType.findACat')}</MenuItem>
                        <MenuItem value={QuestionType.CloseEnough}>{t('questionType.closeEnough')}</MenuItem>
                        <MenuItem value={QuestionType.Choice}>{t('questionType.choice')}</MenuItem>
                        <MenuItem value={QuestionType.TextAnswer}>{t('questionType.textAnswer')}</MenuItem>
                        <MenuItem value={QuestionType.ProgressiveReveal}>{t('questionType.progressiveReveal')}</MenuItem>
                        <MenuItem value={QuestionType.Karaoke}>{t('questionType.karaoke')}</MenuItem>
                        <MenuItem value={QuestionType.Crocodile}>{t('questionType.crocodile')}</MenuItem>
                        <MenuItem value={QuestionType.Voting}>{t('questionType.voting')}</MenuItem>
                    </Select>
                </Box>
            </DialogTitle>

            <DialogContent>
                <Tabs
                    value={tabValue}
                    onChange={(e, newValue) => setTabValue(newValue)}
                    sx={{
                        borderBottom: 1,
                        borderColor: 'var(--glass-border)',
                        marginBottom: 2,
                    }}
                >
                    {isFindACat ? [
                        <Tab key="find-a-cat" label={t('tab.findACatEditor')} />,
                        <Tab key="price" label={t('tab.price')} />
                    ] : isKaraoke ? [
                        <Tab key="karaoke" label={t('tab.karaokeEditor')} />,
                        <Tab key="answer" label={t('tab.answer')} />,
                        <Tab key="price" label={t('tab.price')} />
                    ] : isProgressiveReveal ? [
                        <Tab key="image" label={t('tab.imageEffect')} />,
                        <Tab key="answer" label={t('tab.answer')} />,
                        <Tab key="price" label={t('tab.price')} />
                    ] : isChoice ? [
                        <Tab key="question" label={t('tab.question')} />,
                        <Tab key="options" label={t('tab.options')} />,
                        <Tab key="answer" label={t('tab.answer')} />,
                        <Tab key="price" label={t('tab.price')} />
                    ] : isCrocodile ? [
                        <Tab key="question" label={t('tab.question')} />,
                        <Tab key="price" label={t('tab.price')} />
                    ] : isVoting ? [
                        <Tab key="question" label={t('tab.question')} />,
                        <Tab key="price" label={t('tab.price')} />
                    ] : [
                        <Tab key="question" label={t('tab.question')} />,
                        <Tab key="answer" label={t('tab.answer')} />,
                        <Tab key="price" label={t('tab.price')} />
                    ]}
                </Tabs>

                {isFindACat ? (
                    <>
                        <TabPanel value={tabValue} index={0}>
                            <FindACatEditor
                                image={formData.image}
                                map={formData.map || []}
                                task={formData.task || ''}
                                duration={formData.duration || 60}
                                maxClicks={formData.max_clicks || 0}
                                firstPlaceBonus={formData.first_place_bonus || 0}
                                onImageChange={(image) => setFormData(prev => ({ ...prev, image }))}
                                onMapChange={(map) => setFormData(prev => ({ ...prev, map }))}
                                onTaskChange={(task) => setFormData(prev => ({ ...prev, task }))}
                                onDurationChange={(duration) => setFormData(prev => ({ ...prev, duration }))}
                                onMaxClicksChange={(max_clicks) => setFormData(prev => ({ ...prev, max_clicks }))}
                                onFirstPlaceBonusChange={(first_place_bonus) => setFormData(prev => ({ ...prev, first_place_bonus }))}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            {renderPriceFields()}
                        </TabPanel>
                    </>
                ) : isKaraoke ? (
                    <>
                        <TabPanel value={tabValue} index={0}>
                            <KaraokeEditor
                                media={formData.media}
                                lyrics={formData.lyrics || ''}
                                lyricsFormat={formData.lyrics_format || 'plain'}
                                onMediaChange={(media) => setFormData(prev => ({ ...prev, media }))}
                                onLyricsChange={(lyrics) => setFormData(prev => ({ ...prev, lyrics }))}
                                onLyricsFormatChange={(lyrics_format) => setFormData(prev => ({ ...prev, lyrics_format }))}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            <RuleForm
                                rules={formData.after_round || []}
                                onRulesChange={handleAfterRoundChange}
                                title={t('question.answerTitle')}
                                draftRule={draftAfterRound}
                                onDraftRuleChange={setDraftAfterRound}
                                buttonLabel={t('question.addAnswer')}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={2}>
                            {renderPriceFields()}
                        </TabPanel>
                    </>
                ) : isProgressiveReveal ? (
                    <>
                        <TabPanel value={tabValue} index={0}>
                            <ProgressiveRevealEditor
                                image={formData.image}
                                duration={formData.duration || 60}
                                effect={formData.effect || 'blur'}
                                curve={formData.curve || 'linear'}
                                onImageChange={(image) => setFormData(prev => ({ ...prev, image }))}
                                onDurationChange={(duration) => setFormData(prev => ({ ...prev, duration }))}
                                onEffectChange={(effect) => setFormData(prev => ({ ...prev, effect }))}
                                onCurveChange={(curve) => setFormData(prev => ({ ...prev, curve }))}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            <RuleForm
                                rules={formData.after_round || []}
                                onRulesChange={handleAfterRoundChange}
                                title={t('question.answerTitle')}
                                draftRule={draftAfterRound}
                                onDraftRuleChange={setDraftAfterRound}
                                buttonLabel={t('question.addAnswer')}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={2}>
                            {renderPriceFields()}
                        </TabPanel>
                    </>
                ) : isChoice ? (
                    <>
                        <TabPanel value={tabValue} index={0}>
                            <RuleForm
                                rules={formData.rules || []}
                                onRulesChange={handleRulesChange}
                                title={t('question.questionTitle')}
                                draftRule={draftRule}
                                onDraftRuleChange={setDraftRule}
                                buttonLabel={t('question.addQuestion')}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            <ChoiceOptionsEditor
                                options={formData.options || []}
                                multiple={!!formData.multiple}
                                onOptionsChange={(options) => setFormData(prev => ({ ...prev, options }))}
                                onMultipleChange={(multiple) => setFormData(prev => ({ ...prev, multiple }))}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={2}>
                            <RuleForm
                                rules={formData.after_round || []}
                                onRulesChange={handleAfterRoundChange}
                                title={t('question.answerExplanationTitle')}
                                draftRule={draftAfterRound}
                                onDraftRuleChange={setDraftAfterRound}
                                buttonLabel={t('question.addAnswer')}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={3}>
                            {renderPriceFields()}
                        </TabPanel>
                    </>
                ) : isCrocodile ? (
                    <>
                        <TabPanel value={tabValue} index={0}>
                            <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-start' }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                                        {t('question.crocodileMode')}
                                    </Typography>
                                    <Select
                                        value={formData.crocodile_mode || 'fastest'}
                                        onChange={(e) => setFormData(prev => ({ ...prev, crocodile_mode: e.target.value as 'fastest' | 'dixit' }))}
                                        size="small"
                                        sx={{
                                            minWidth: '240px',
                                            background: 'var(--input-bg)',
                                            border: '1px solid var(--glass-border)',
                                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                        }}
                                    >
                                        <MenuItem value="fastest">{t('question.crocodileModeFastest')}</MenuItem>
                                        <MenuItem value="dixit">{t('question.crocodileModeDixit')}</MenuItem>
                                    </Select>
                                    <Typography variant="caption" sx={{ color: 'var(--text-muted)', maxWidth: '320px' }}>
                                        {t('question.crocodileModeHelper')}
                                    </Typography>
                                </Box>
                                <TextField
                                    label={t('question.durationSeconds')}
                                    type="number"
                                    value={formData.duration || 30}
                                    onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                    sx={{ minWidth: '180px' }}
                                    helperText={t('question.crocodileDurationHelper')}
                                />
                            </Box>
                            <RuleForm
                                rules={formData.rules || []}
                                onRulesChange={handleRulesChange}
                                title={t('question.questionTitle')}
                                draftRule={draftRule}
                                onDraftRuleChange={setDraftRule}
                                buttonLabel={t('question.addQuestion')}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            {renderPriceFields()}
                        </TabPanel>
                    </>
                ) : isVoting ? (
                    <>
                        <TabPanel value={tabValue} index={0}>
                            <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'flex-start' }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                                        {t('question.voteMode')}
                                    </Typography>
                                    <Select
                                        value={formData.vote_mode || 'open'}
                                        onChange={(e) => setFormData(prev => ({ ...prev, vote_mode: e.target.value as 'open' | 'closed' }))}
                                        size="small"
                                        sx={{
                                            minWidth: '240px',
                                            background: 'var(--input-bg)',
                                            border: '1px solid var(--glass-border)',
                                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                        }}
                                    >
                                        <MenuItem value="open">{t('question.voteModeOpen')}</MenuItem>
                                        <MenuItem value="closed">{t('question.voteModeClosed')}</MenuItem>
                                    </Select>
                                    <Typography variant="caption" sx={{ color: 'var(--text-muted)', maxWidth: '320px' }}>
                                        {t('question.voteModeHelper')}
                                    </Typography>
                                </Box>
                                <TextField
                                    label={t('question.durationSeconds')}
                                    type="number"
                                    value={formData.duration || 60}
                                    onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                    sx={{ minWidth: '180px' }}
                                    helperText={t('question.votingDurationHelper')}
                                />
                            </Box>
                            <RuleForm
                                rules={formData.rules || []}
                                onRulesChange={handleRulesChange}
                                title={t('question.questionTitle')}
                                draftRule={draftRule}
                                onDraftRuleChange={setDraftRule}
                                buttonLabel={t('question.addQuestion')}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            {renderPriceFields()}
                        </TabPanel>
                    </>
                ) : (
                    <>
                        <TabPanel value={tabValue} index={0}>
                            <RuleForm
                                rules={formData.rules || []}
                                onRulesChange={handleRulesChange}
                                title={t('question.questionTitle')}
                                draftRule={draftRule}
                                onDraftRuleChange={setDraftRule}
                                buttonLabel={t('question.addQuestion')}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            {isCloseEnough && (
                                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                    <TextField
                                        label={t('question.correctAnswerNumber')}
                                        type="number"
                                        value={answerInputValue}
                                        onChange={(e) => setAnswerInputValue(e.target.value)}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        fullWidth
                                        helperText={t('question.correctAnswerHelper')}
                                    />
                                    <TextField
                                        label={t('question.durationSeconds')}
                                        type="number"
                                        value={formData.duration || 30}
                                        onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        sx={{ minWidth: '180px' }}
                                        helperText={t('question.durationHelper')}
                                    />
                                    <TextField
                                        label={t('question.perfectBonus')}
                                        type="number"
                                        value={formData.perfect_bonus || 0}
                                        onChange={(e) => setFormData(prev => ({ ...prev, perfect_bonus: Math.max(0, parseInt(e.target.value) || 0) }))}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        inputProps={{ min: 0 }}
                                        sx={{ minWidth: '180px' }}
                                        helperText={t('question.perfectBonusHelper')}
                                    />
                                </Box>
                            )}
                            <RuleForm
                                rules={formData.after_round || []}
                                onRulesChange={handleAfterRoundChange}
                                title={isCloseEnough ? t('question.answerExplanationTitle') : t('question.answerTitle')}
                                draftRule={draftAfterRound}
                                onDraftRuleChange={setDraftAfterRound}
                                buttonLabel={t('question.addAnswer')}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={2}>
                            {renderPriceFields()}
                        </TabPanel>
                    </>
                )}
            </DialogContent>

            <DialogActions sx={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                {getValidationErrorMessage() && (
                    <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
                        {getValidationErrorMessage()}
                    </Typography>
                )}
                <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ width: '100%' }}>
                    <Button onClick={onClose} variant="outlined">
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleSave} variant="contained" disabled={!isFindACatValid || !isCloseEnoughValid || !isChoiceValid || !isProgressiveRevealValid || !isKaraokeValid}>
                        {t('question.save')}
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
};

export default QuestionModal;
