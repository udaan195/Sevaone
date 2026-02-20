import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  SafeAreaView, ActivityIndicator, ScrollView 
} from 'react-native';
import { db, auth } from '../../api/firebaseConfig';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function RecommendedScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [perfectMatches, setPerfectMatches] = useState([]);
  const [potentialMatches, setPotentialMatches] = useState([]);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 1. Fetch User Profile & Applications
      const userSnap = await getDoc(doc(db, "users", userId));
      const userProfile = userSnap.exists() ? userSnap.data().profileEligibility || {} : {};
      
      const appSnap = await getDocs(query(collection(db, "applications"), where("userId", "==", userId)));
      const appliedJobIds = appSnap.docs.map(d => d.data().jobId);

      // 2. Fetch All Jobs
      const jobsSnap = await getDocs(collection(db, "gov_jobs"));
      const allJobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const perfect = [];
      const potential = [];

      allJobs.forEach(job => {
        const questions = job.eligibilityQuestions || [];
        if (questions.length === 0) return;

        let matchCount = 0;
        let mismatchCount = 0;

        questions.forEach(q => {
          const userAns = userProfile[q.question];
          if (userAns === 'Yes') matchCount++;
          else if (userAns === 'No') mismatchCount++;
          // Agar data nahi hai toh use mismatch nahi maanenge (pending check)
        });

        const totalQ = questions.length;
        const matchPercent = Math.round((matchCount / totalQ) * 100);

        // 3. Filtering Logic
        if (mismatchCount > 3) return; // Rule: 3-4 se zyada mismatch toh hide karo

        const jobItem = { ...job, matchPercent, isApplied: appliedJobIds.includes(job.id) };

        if (matchPercent === 100) {
          perfect.push(jobItem);
        } else if (matchPercent >= 60) { // Rule: At least 60% match for potential
          potential.push(jobItem);
        }
      });

      setPerfectMatches(perfect);
      setPotentialMatches(potential);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const renderJobCard = (item, isPerfect) => (
    <TouchableOpacity 
      style={[styles.card, isPerfect ? styles.perfectCard : styles.potentialCard]}
      onPress={() => navigation.navigate('Home', { 
  screen: 'JobDetails', 
  params: { job: item } 
})}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.jobTitle}>{item.title}</Text>
        {item.isApplied && (
          <View style={styles.appliedBadge}>
            <Text style={styles.badgeText}>ALREADY APPLIED</Text>
          </View>
        )}
      </View>

      <View style={styles.matchRow}>
        <MaterialCommunityIcons 
          name={isPerfect ? "check-decagram" : "Chart-donut"} 
          size={20} 
          color={isPerfect ? "#10B981" : "#F59E0B"} 
        />
        <Text style={[styles.matchText, {color: isPerfect ? "#10B981" : "#F59E0B"}]}>
          {isPerfect ? "Perfect Match" : `${item.matchPercent}% Profile Match`}
        </Text>
      </View>

      {!isPerfect && (
        <Text style={styles.hintText}>Tap to check remaining eligibility criteria</Text>
      )}
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#003366" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{padding: 20}}>
        <Text style={styles.screenTitle}>Recommended Jobs ✨</Text>
        
        {perfectMatches.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Top Matches for You</Text>
            {perfectMatches.map(item => renderJobCard(item, true))}
          </View>
        )}

        {potentialMatches.length > 0 && (
          <View style={{marginTop: 20}}>
            <Text style={styles.sectionTitle}>Improve Your Eligibility</Text>
            {potentialMatches.map(item => renderJobCard(item, false))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  screenTitle: { fontSize: 26, fontWeight: '900', color: '#003366', marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#64748B', marginBottom: 15, textTransform: 'uppercase' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 15, elevation: 3 },
  perfectCard: { borderLeftWidth: 6, borderLeftColor: '#10B981' },
  potentialCard: { borderLeftWidth: 6, borderLeftColor: '#F59E0B' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  jobTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', flex: 1 },
  appliedBadge: { backgroundColor: '#F1F5F9', padding: 5, borderRadius: 5 },
  badgeText: { fontSize: 9, fontWeight: '900', color: '#64748B' },
  matchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  matchText: { marginLeft: 8, fontWeight: '800', fontSize: 13 },
  hintText: { fontSize: 11, color: '#94A3B8', marginTop: 10, fontStyle: 'italic' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
