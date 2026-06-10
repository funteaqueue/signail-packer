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
import { Question, QuestionType, Rule, RuleType } from '../types/pack';
import { isContentEmpty } from '../utils/contentUtils';
import RuleForm from './RuleForm';
import FindACatEditor from './FindACatEditor';
import ChoiceOptionsEditor from './ChoiceOptionsEditor';
import ProgressiveRevealEditor from './ProgressiveRevealEditor';


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

    const getValidationErrorMessage = () => {
        if (isCloseEnough && !isCloseEnoughValid) {
            return 'Please enter the numeric correct answer to save the question.';
        }
        if (isChoice && !isChoiceValid) {
            if ((formData.options || []).length < 2) {
                return 'Please add at least two options to save the question.';
            }
            return formData.multiple
                ? 'Please mark at least one option as correct.'
                : 'Please mark exactly one option as correct.';
        }
        if (isProgressiveReveal && !isProgressiveRevealValid) {
            return 'Please upload an image to save the question.';
        }
        if (!isFindACat) return null;
        const missing = [];
        if (!formData.task?.trim()) missing.push('the task text ("What to find?")');
        if (!formData.image) missing.push('an image upload');
        if (!formData.map || formData.map.length === 0) missing.push('at least one defined area');

        if (missing.length > 0) {
            return `Please add ${missing.join(', ')} to save the question.`;
        }
        return null;
    };

    const handleSave = () => {
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
                content: convertMediaTags(draftRule.content!),
            } as Rule;
            currentRules.push(ruleToAdd);
        }

        let currentAfterRound = [...(formData.after_round || [])];
        if (!isContentEmpty(draftAfterRound.content)) {
            const ruleToAdd = {
                ...draftAfterRound,
                content: convertMediaTags(draftAfterRound.content!),
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
                label="Correct Points"
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
                label="Price Text"
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
                label="Incorrect Points"
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
                    label="Bonus for 1st place"
                    type="number"
                    value={formData.first_place_bonus || 0}
                    onChange={(e) => setFormData(prev => ({
                        ...prev,
                        first_place_bonus: Math.max(0, parseInt(e.target.value) || 0),
                    }))}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    inputProps={{ min: 0 }}
                    helperText={isChoice
                        ? 'Extra points for the fastest correct answer, on top of the normal award. 0 = none'
                        : 'Extra points for the fastest answerer, on top of the normal award. 0 = none'}
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
                    background: 'rgba(19, 26, 54, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                },
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h6" className="gradient-text">
                    {question ? 'Edit Question' : 'New Question'} - {formData.price?.text || '100'} Points
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ color: '#a8b2d1' }}>Question Type:</Typography>
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
                            background: 'rgba(19, 26, 54, 0.6)',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            '& .MuiOutlinedInput-notchedOutline': {
                                border: 'none'
                            }
                        }}
                    >
                        <MenuItem value={QuestionType.Normal}>Normal</MenuItem>
                        <MenuItem value={QuestionType.Secret}>Secret</MenuItem>
                        <MenuItem value={QuestionType.Empty}>Empty</MenuItem>
                        <MenuItem value={QuestionType.FindACat}>Find-a-Cat</MenuItem>
                        <MenuItem value={QuestionType.CloseEnough}>Close Enough</MenuItem>
                        <MenuItem value={QuestionType.Choice}>Choice</MenuItem>
                        <MenuItem value={QuestionType.TextAnswer}>Text Answer</MenuItem>
                        <MenuItem value={QuestionType.ProgressiveReveal}>Progressive Reveal</MenuItem>
                    </Select>
                </Box>
            </DialogTitle>

            <DialogContent>
                <Tabs
                    value={tabValue}
                    onChange={(e, newValue) => setTabValue(newValue)}
                    sx={{
                        borderBottom: 1,
                        borderColor: 'rgba(139, 92, 246, 0.3)',
                        marginBottom: 2,
                    }}
                >
                    {isFindACat ? [
                        <Tab key="find-a-cat" label="Find-a-Cat Editor" />,
                        <Tab key="price" label="Price" />
                    ] : isProgressiveReveal ? [
                        <Tab key="image" label="Image & Effect" />,
                        <Tab key="answer" label="Answer" />,
                        <Tab key="price" label="Price" />
                    ] : isChoice ? [
                        <Tab key="question" label="Question" />,
                        <Tab key="options" label="Options" />,
                        <Tab key="answer" label="Answer" />,
                        <Tab key="price" label="Price" />
                    ] : [
                        <Tab key="question" label="Question" />,
                        <Tab key="answer" label="Answer" />,
                        <Tab key="price" label="Price" />
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
                                title="Answer"
                                draftRule={draftAfterRound}
                                onDraftRuleChange={setDraftAfterRound}
                                buttonLabel="Add Answer"
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
                                title="Question"
                                draftRule={draftRule}
                                onDraftRuleChange={setDraftRule}
                                buttonLabel="Add Question"
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
                                title="Answer explanation (optional)"
                                draftRule={draftAfterRound}
                                onDraftRuleChange={setDraftAfterRound}
                                buttonLabel="Add Answer"
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={3}>
                            {renderPriceFields()}
                        </TabPanel>
                    </>
                ) : (
                    <>
                        <TabPanel value={tabValue} index={0}>
                            <RuleForm
                                rules={formData.rules || []}
                                onRulesChange={handleRulesChange}
                                title="Question"
                                draftRule={draftRule}
                                onDraftRuleChange={setDraftRule}
                                buttonLabel="Add Question"
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            {isCloseEnough && (
                                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                    <TextField
                                        label="Correct Answer (number)*"
                                        type="number"
                                        value={answerInputValue}
                                        onChange={(e) => setAnswerInputValue(e.target.value)}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        fullWidth
                                        helperText="Players submit numbers; the closest one wins"
                                    />
                                    <TextField
                                        label="Duration (seconds)"
                                        type="number"
                                        value={formData.duration || 30}
                                        onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        sx={{ minWidth: '180px' }}
                                        helperText="Time window to submit answers"
                                    />
                                    <TextField
                                        label="Perfect guess bonus"
                                        type="number"
                                        value={formData.perfect_bonus || 0}
                                        onChange={(e) => setFormData(prev => ({ ...prev, perfect_bonus: Math.max(0, parseInt(e.target.value) || 0) }))}
                                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                        inputProps={{ min: 0 }}
                                        sx={{ minWidth: '180px' }}
                                        helperText="Extra points for the exact answer. 0 = none"
                                    />
                                </Box>
                            )}
                            <RuleForm
                                rules={formData.after_round || []}
                                onRulesChange={handleAfterRoundChange}
                                title={isCloseEnough ? 'Answer explanation (optional)' : 'Answer'}
                                draftRule={draftAfterRound}
                                onDraftRuleChange={setDraftAfterRound}
                                buttonLabel="Add Answer"
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
                        Cancel
                    </Button>
                    <Button onClick={handleSave} variant="contained" disabled={!isFindACatValid || !isCloseEnoughValid || !isChoiceValid || !isProgressiveRevealValid}>
                        Save Question
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
};

export default QuestionModal;
