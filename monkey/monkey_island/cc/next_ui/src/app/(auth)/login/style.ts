import { Theme } from '@mui/system';
import increaseContrast from '@/lib/styling/increaseContrast';

export const cardStyle = (theme: Theme) => {
    return {
        padding: '2em',
        zIndex: 100,
        backgroundColor: increaseContrast(
            theme.palette.background.default,
            theme,
            0.3
        ),
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px'
    };
};

export const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    minHeight: '100vh'
};
