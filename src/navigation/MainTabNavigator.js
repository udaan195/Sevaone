import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { db } from '../api/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack'; // ✨ Naya import
import { MaterialCommunityIcons } from '@expo/vector-icons';

// --- SCREENS IMPORT ---
import HomeStack from './HomeStack'; 
import ApplicationsScreen from '../screens/Main/ApplicationsScreen';
import RecommendedScreen from '../screens/Main/RecommendedScreen';
import HelpScreen from '../screens/Main/HelpScreen';
import NotificationsScreen from '../screens/Main/NotificationsScreen';
import ProfileScreen from '../screens/Main/ProfileScreen';
import EditProfile from '../screens/Main/EditProfile'; // ✨ EditProfile import kiya
import PrivacyPolicy from '../screens/Main/PrivacyPolicy';
import ReferEarn from '../screens/Main/ReferEarn';
import ChangePasswordScreen from '../screens/Main/ChangePasswordScreen';
import MembershipScreen        from '../screens/Main/MembershipScreen';
import MembershipHistoryScreen  from '../screens/Main/MembershipHistoryScreen';
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator(); // ✨ Stack Navigator banaya

// --- ✨ PROFILE STACK (EditProfile ko support karne ke liye) ---
function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#003366' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen 
        name="ProfileRoot" 
        component={ProfileScreen} 
        options={{ title: 'Meri Profile' }} 
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfile} 
        options={{ title: 'Update Profile' }} 
      />
      <Stack.Screen 
  name="PrivacyPolicy" 
  component={PrivacyPolicy} 
  options={{ title: 'Privacy Policy' }} 
/>
<Stack.Screen 
name="ReferEarn"
component={ReferEarn}
options={{title: 'Refer & Earn'}} />
<Stack.Screen
name="ApplicationsScreen"
component={ApplicationsScreen}
options={{title: 'Application Screen'}}
/>
<Stack.Screen
  name="Membership"
  component={MembershipScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
  name="MembershipHistory"
  component={MembershipHistoryScreen}
  options={{ headerShown: false }}
/>
<Stack.Screen
name="ChangePassword"
component={ChangePasswordScreen}
options={{ headerShown: false }}
/>
    </Stack.Navigator>
  );
}

export default function MainTabNavigator() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('isRead', '==', false)
    );
    const unsub = onSnapshot(q, snap => setUnreadCount(snap.size));
    return () => unsub();
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#003366',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 5 },
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ color, size, focused }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Application') iconName = focused ? 'file-document' : 'file-document-outline';
          else if (route.name === 'Recommended') iconName = focused ? 'star' : 'star-outline';
          else if (route.name === 'Help') iconName = focused ? 'help-circle' : 'help-circle-outline';
          else if (route.name === 'Profile') iconName = focused ? 'account' : 'account-outline';

          return <MaterialCommunityIcons name={iconName} size={focused ? size + 4 : size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <View>
              <MaterialCommunityIcons
                name={focused ? 'home' : 'home-outline'}
                size={focused ? size + 4 : size}
                color={color}
              />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      
      <Tab.Screen 
        name="Application" 
        component={ApplicationsScreen} 
        options={{ tabBarLabel: 'Application' }} 
      />

      <Tab.Screen 
        name="Recommended" 
        component={RecommendedScreen} 
        options={{
          tabBarLabel: 'For You',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="star-face" color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen 
        name="Help" 
        component={HelpScreen} 
        options={{
          tabBarLabel: 'Help',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="help-circle" color={color} size={size} />
          ),
        }}
      />

      {/* --- ✨ PROFILE TAB UPDATED (Ab ye ProfileStack use karega) --- */}
      <Tab.Screen 
        name="Profile" 
        component={ProfileStack} 
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="account-circle" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: { height: 70, paddingBottom: 10, paddingTop: 10, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e2e8f0', elevation: 10 },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  placeholderText: { fontSize: 18, color: '#003366', fontWeight: 'bold' },
  notifBadge: { position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' }
});
