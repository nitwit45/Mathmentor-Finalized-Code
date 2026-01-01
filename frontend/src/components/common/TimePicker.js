import { useState } from 'react';
import dayjs from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { MobileTimePicker } from '@mui/x-date-pickers/MobileTimePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';

function TimePicker({ value, onChange, placeholder = "Choose a time" }) {
  const [timeValue, setTimeValue] = useState(() => {
    if (value) {
      const [h, m] = value.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        return dayjs().hour(h).minute(m);
      }
    }
    return null;
  });

  const handleChange = (newValue) => {
    setTimeValue(newValue);
    if (newValue) {
      const timeStr = newValue.format('HH:mm');
      onChange({ target: { name: 'time', value: timeStr } });
    } else {
      onChange({ target: { name: 'time', value: '' } });
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <MobileTimePicker
        value={timeValue}
        onChange={handleChange}
        viewRenderers={{
          hours: renderTimeViewClock,
          minutes: renderTimeViewClock,
        }}
        slotProps={{
          textField: {
            placeholder: placeholder,
            fullWidth: true,
            variant: 'outlined',
            InputProps: {
              sx: {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                color: 'rgba(245, 245, 245, 0.95)',
                fontSize: '14px',
                fontFamily: 'inherit',
                '& fieldset': {
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  borderWidth: '1px',
                },
                '&:hover fieldset': {
                  borderColor: '#d4a03c',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#d4a03c',
                  borderWidth: '1px',
                },
              },
            },
            inputProps: {
              sx: {
                color: 'rgba(245, 245, 245, 0.95)',
                padding: '12px',
                fontSize: '14px',
                fontFamily: 'inherit',
                '&::placeholder': {
                  color: 'rgba(180, 180, 180, 0.6)',
                  opacity: 1,
                },
              },
            },
            sx: {
              '& .MuiInputAdornment-root .MuiIconButton-root': {
                color: 'rgba(180, 180, 180, 0.8)',
              },
            },
          },
          dialog: {
            sx: {
              '& .MuiDialog-paper': {
                backgroundColor: '#1a1a1a',
                borderRadius: '16px',
                overflow: 'hidden',
              },
              '& .MuiPickersLayout-root': {
                backgroundColor: '#1a1a1a',
              },
              '& .MuiPickersLayout-contentWrapper': {
                backgroundColor: '#1a1a1a',
              },
              '& .MuiTimeClock-root': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
              '& .MuiClock-root': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
              '& .MuiClockNumber-root': {
                color: 'rgba(180, 180, 180, 0.8)',
              },
              '& .MuiClockNumber-root.Mui-selected': {
                backgroundColor: '#d4a03c',
                color: '#1a1a1a',
              },
              '& .MuiClock-pin': {
                backgroundColor: '#d4a03c',
              },
              '& .MuiClockPointer-root': {
                backgroundColor: '#d4a03c',
              },
              '& .MuiClockPointer-thumb': {
                backgroundColor: '#d4a03c',
                borderColor: '#d4a03c',
              },
              '& .MuiPickersToolbar-root': {
                background: 'linear-gradient(135deg, #c9942a 0%, #d4a03c 50%, #b8872a 100%)',
              },
              '& .MuiTypography-root': {
                color: 'rgba(245, 245, 245, 0.95)',
              },
              '& .MuiPickersToolbar-root .MuiTypography-root': {
                color: 'rgba(255, 255, 255, 0.7)',
              },
              '& .MuiPickersToolbar-root .Mui-selected': {
                color: '#ffffff',
              },
              '& .MuiTimePickerToolbar-ampmSelection .MuiTypography-root': {
                color: 'rgba(255, 255, 255, 0.5)',
              },
              '& .MuiTimePickerToolbar-ampmSelection .Mui-selected': {
                color: '#ffffff',
              },
              '& .MuiDialogActions-root': {
                backgroundColor: '#1a1a1a',
              },
              '& .MuiButton-root': {
                color: '#d4a03c',
                fontWeight: 600,
              },
            },
          },
        }}
      />
    </LocalizationProvider>
  );
}

export default TimePicker;
