'use client';

import {Box, Paper, Skeleton, Stack} from '@mui/material';
import {MainHeaderSkeleton} from '../layout/MainHeader';

export function ObjectPageSkeleton() {
    return (
        <Stack spacing={1.5} sx={{height: '100%', minHeight: 0}}>
            <MainHeaderSkeleton titleWidth={420} subtitleWidth="32%"/>

            <Stack direction={{xs: 'column', lg: 'row'}} spacing={1.5}
                   sx={{flex: 1, minHeight: 0, alignItems: 'stretch'}}>
                <Paper sx={{borderRadius: '10px', flex: 1, minHeight: 0, overflow: 'hidden'}}>
                    <Box sx={{height: '100%', overflow: 'auto', p: 2.5}}>
                        <Stack spacing={1.5}>
                            {Array.from({length: 9}).map((_, index) => (
                                <Skeleton key={index} variant="rounded" width="100%" height={56}/>
                            ))}
                        </Stack>
                    </Box>
                </Paper>

                <Paper
                    sx={{
                        width: {xs: '100%', lg: 280},
                        flexShrink: 0,
                        borderRadius: '10px',
                        p: 1.5,
                        alignSelf: 'flex-start',
                    }}
                >
                    <Stack spacing={1}>
                        <Skeleton variant="text" width={90} height={28}/>
                        <Skeleton variant="rounded" width="100%" height={40}/>
                        <Skeleton variant="rounded" width="100%" height={40}/>
                    </Stack>
                </Paper>
            </Stack>
        </Stack>
    );
}
