import React from 'react';
import Operations from './operations';
import Sheets from '../homeBody/sheets';
import ResponsiveSplitView from '@/components/base/responsiveSplitView';

export default function HomeBodyHorizontal() {
    return (
        <ResponsiveSplitView primary={<Operations />} secondary={<Sheets />} />
    );
}
