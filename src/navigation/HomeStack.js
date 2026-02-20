import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// --- MAIN SCREENS ---
import HomeScreen from '../screens/Main/Home';
import JobList from '../screens/Main/JobList'; // Nayi Dynamic List File
import JobDetails from '../screens/Main/JobDetails'; // Nayi Details File
import NotificationsScreen from '../screens/Main/NotificationsScreen';
// --- TOP LEVEL SERVICE HOMES ---
import GovtJobsHome from '../screens/Main/Services/GovtJobs/GovtJobsHome';
import ApplyWizard from '../screens/Main/ApplyWizard';
import ApplicationReview from '../screens/Main/ApplicationReview';
import SubmitSuccess from '../screens/Main/SubmitSuccess'; 
import WalletScreen from '../screens/Main/Wallet';
import CitizenHome from '../screens/Main/CitizenHome';
import OtherHome from '../screens/Main/OtherHome';
import GovtSchemesHome from '../screens/Main/GovtSchemesHome';
import StudentHome from '../screens/Main/StudentHome';
import ServiceList from '../screens/Main/Services/ServiceList';
import ServiceDetails from '../screens/Main/ServiceDetails';
import ServiceWizard from '../screens/Main/ServiceWizard';
import ServiceReview from '../screens/Main/ServiceReview';
import NotificationManager from '../screens/Main/NotificationManager';

const Stack = createStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerStyle: { backgroundColor: '#003366', elevation: 5 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerBackTitleVisible: false,
      }}
    >
      {/* 1. Main Dashboard */}
      <Stack.Screen name="HomeRoot" component={HomeScreen} options={{ headerShown: false }} />

      {/* 2. Top Level Services */}
      <Stack.Screen name="GovtJobs" component={GovtJobsHome} options={{ title: 'Government Jobs' }} />
      
      
      {/* 3. DYNAMIC GOVT JOBS (Replacement of 4 old files) */}
      <Stack.Screen 
        name="JobList" 
        component={JobList} 
        options={({ route }) => ({ 
          title: route.params?.category?.replace('-', ' ').toUpperCase() || 'Jobs List' 
        })} 
      />
      <Stack.Screen 
        name="JobDetails" 
        component={JobDetails} 
        options={{ title: 'Job Details' }} 
      />


    
      <Stack.Screen name="Wallet" component={WalletScreen} options={{ title: 'My Wallet' }} />
      <Stack.Screen 
  name="ApplyWizard" 
  component={ApplyWizard} 
  options={({ route }) => ({ title: `Apply: ${route.params.jobTitle}` })} 
/>
<Stack.Screen 
  name="Notifications" 
  component={NotificationsScreen} 
  options={{ title: 'Updates & Alerts' }} 
/>

<Stack.Screen 
  name="ApplicationReview" 
  component={ApplicationReview} 
  // Line 106 Fixed: Proper string and closed braces
  options={{ 
    title: 'Review & Pay', 
    headerTitleAlign: 'center' 
  }} 
/>
<Stack.Screen 
  name="SubmitSuccess" // <--- Ye naam exact hona chahiye (Case Sensitive)
  component={SubmitSuccess} 
  options={{ 
    headerShown: false, 
    gestureEnabled: false 
  }} 
/>
<Stack.Screen 
  name="CitizenServices" 
  component={CitizenHome} 
  options={{ title: 'Citizen Services' }} 
/>

<Stack.Screen 
  name="GovtSchemes" 
  component={GovtSchemesHome} 
  options={{ title: 'Government Schemes' }} 
/>

<Stack.Screen 
  name="Students" 
  component={StudentHome} 
  options={{ title: 'Student Corner' }} 
/>

<Stack.Screen 
  name="Others" 
  component={OtherHome} 
  options={{ title: 'Other Services' }} 
/>
<Stack.Screen 
  name="ServiceWizard" 
  component={ServiceWizard} 
  options={({ route }) => ({ 
    // ✨ ?. lagane se undefined error nahi aayega
    title: route.params?.serviceData?.title ? `Apply: ${route.params.serviceData.title}` : 'Loading...',
    headerStyle: { backgroundColor: '#003366' },
    headerTintColor: '#fff',
  })} 
/>
{/* ✨ Ye sabse important screen hai jahan services ki list dikhegi */}<Stack.Screen 
  name="ServiceList" 
  component={ServiceList} 
  options={{ headerShown: false }} // 👈 Ye line double header ko gayab kar degi
/>
<Stack.Screen 
  name="ServiceDetails" 
  component={ServiceDetails} 
  options={{ headerShown: false }} // Hamara custom header dikhega
/>
<Stack.Screen 
  name="ServiceReview" 
  component={ServiceReview} 
  options={{ 
    title: 'Review & Payment', 
    headerStyle: { backgroundColor: '#003366' },
    headerTintColor: '#fff',
    headerTitleStyle: { fontWeight: '900' },
  }} 
/>

    </Stack.Navigator>
  );
}
