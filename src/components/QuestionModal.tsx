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


interface QuestionModalProps {
    open: boolean;
    question: Question | null;
    questionIndex: number;
    onSave: (question: Question) => void;
    onClose: () => void;
}

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
        name: '',
        image: '',
        map: [],
        duration: 60,
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

    useEffect(() => {
        if (question) {
            setFormData(question);
            setIncorrectInputValue(question.price?.incorrect?.toString() || '0');
            setCorrectInputValue(question.price?.correct?.toString() || '0');
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
                name: '',
                image: '',
                map: [],
                duration: 60,
            });
            setIncorrectInputValue((-defaultPrice).toString());
            setCorrectInputValue(defaultPrice.toString());
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
    
    const isFindACatValid = !isFindACat || (
        !!formData.name?.trim() &&
        !!formData.image &&
        Array.isArray(formData.map) &&
        formData.map.length > 0
    );

    const getValidationErrorMessage = () => {
        if (!isFindACat) return null;
        const missing = [];
        if (!formData.name?.trim()) missing.push('target name ("What to find?")');
        if (!formData.image) missing.push('an image upload');
        if (!formData.map || formData.map.length === 0) missing.push('at least one defined area');
        
        if (missing.length > 0) {
            return `Please add ${missing.join(', ')} to save the question.`;
        }
        return null;
    };

    const handleSave = () => {
        let updatedQuestion: Question;
        
        if (formData.type === QuestionType.FindACat) {
            updatedQuestion = {
                ...formData,
                id: formData.id || Date.now(),
                type: QuestionType.FindACat,
                price: formData.price || {
                    text: '100',
                    correct: 100,
                    incorrect: -100,
                    random_range: 'null',
                },
                name: formData.name || '',
                image: formData.image || '',
                map: formData.map || [],
                duration: formData.duration || 60,
                rules: [],
                after_round: [],
            } as Question;
        } else {
            // Auto-save drafts if they have content
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

            updatedQuestion = {
                ...formData,
                id: formData.id || Date.now(),
                type: formData.type || QuestionType.Normal,
                price: formData.price || {
                    text: '100',
                    correct: 100,
                    incorrect: -100,
                    random_range: 'null',
                },
                rules: currentRules,
                after_round: currentAfterRound,
                name: undefined,
                image: undefined,
                map: undefined,
                duration: undefined,
            } as Question;
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
                                name={formData.name || ''}
                                duration={formData.duration || 60}
                                onImageChange={(image) => setFormData(prev => ({ ...prev, image }))}
                                onMapChange={(map) => setFormData(prev => ({ ...prev, map }))}
                                onNameChange={(name) => setFormData(prev => ({ ...prev, name }))}
                                onDurationChange={(duration) => setFormData(prev => ({ ...prev, duration }))}
                            />
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
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
                            </Box>
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
                            </Box>
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
                    <Button onClick={handleSave} variant="contained" disabled={!isFindACatValid}>
                        Save Question
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
};

export default QuestionModal;
