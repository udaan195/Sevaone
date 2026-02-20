import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from '../screens/Main/Home';
import GovtJobsHome from '../screens/Main/Services/GovtJobs/GovtJobsHome';
// Baaki screens ko bhi isi tarah import karein...

const Stack = createStackNavigator();

export default function ServiceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true, headerTintColor: '#003366' }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GovtJobs" component={GovtJobsHome} options={{ title: 'Government Jobs' }} />
      {/* Baaki 5 screens ko yahan register karein */}
    </Stack.Navigator>
  );
}
