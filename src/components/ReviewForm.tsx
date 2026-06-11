import React from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
} from '@mui/material';
import { Pack } from '../types/pack';
import { useTranslation } from '../i18n/LanguageContext';

interface ReviewFormProps {
  packData: Pack;
  onDownload: () => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ packData, onDownload }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        {t('review.title')}
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t('basicInfo.title')}
        </Typography>
        <Typography>{t('review.name')} {packData.name}</Typography>
        <Typography>{t('review.author')} {packData.author}</Typography>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" gutterBottom>
          {t('rounds.title')}
        </Typography>
        <List>
          {packData.rounds.map((round, roundIndex) => (
            <React.Fragment key={roundIndex}>
              <ListItem>
                <ListItemText
                  primary={round.name}
                  secondary={
                    <Box>
                      {round.themes.map((theme, themeIndex) => (
                        <Box key={themeIndex} sx={{ mt: 1 }}>
                          <Typography variant="body2">
                            {t('review.theme')} {theme.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('review.description')} {theme.description}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  }
                />
              </ListItem>
              {roundIndex < packData.rounds.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button variant="contained" onClick={onDownload}>
          {t('review.downloadJson')}
        </Button>
      </Box>
    </Box>
  );
};

export default ReviewForm; 