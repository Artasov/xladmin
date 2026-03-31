'use client';

import {Box, Paper, Skeleton, Stack} from '@mui/material';
import {MainHeaderSkeleton} from '../layout/MainHeader';

export function ModelPageSkeleton() {
    return (
        <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
            <MainHeaderSkeleton titleWidth={240} subtitleWidth="38%"/>

            <Paper sx={{p: 1.5, borderRadius: '10px', flexShrink: 0}}>
                <Stack direction={{xs: 'column', lg: 'row'}} spacing={1.5} alignItems={{lg: 'center'}}>
                    <Skeleton variant="rounded" width={360} height={40}/>
                    <Skeleton variant="rounded" width={128} height={40}/>
                    <Box sx={{flex: 1}}/>
                    <Skeleton variant="rounded" width={110} height={24}/>
                </Stack>
            </Paper>

            <Paper sx={{borderRadius: '10px', flex: 1, minHeight: 0, overflow: 'hidden'}}>
                <ModelTableSkeleton/>
            </Paper>
        </Stack>
    );
}

export function ModelTableSkeleton() {
    return (
        <Box sx={{height: '100%', overflow: 'auto', p: 1.5}}>
            <Stack spacing={1}>
                <Skeleton variant="rounded" width="100%" height={42}/>
                {Array.from({length: 10}).map((_, index) => (
                    <Skeleton key={index} variant="rounded" width="100%" height={48}/>
                ))}
            </Stack>
        </Box>
    );
}
