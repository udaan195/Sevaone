import React from 'react';
import { View, Text, Button } from 'react-native';
import { auth } from '../../api/firebaseConfig';
export default function ProfileScreen() {
  return <View style={{flex:1, justifyContent:'center', alignItems:'center'}}><Button title="Logout" onPress={()=>auth.signOut()} /></View>;
}
