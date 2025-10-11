// MyStoreScreen.js
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

export default function MyStoreScreen({ navigation }) {
  const items = [
    { name: "Edward Elric", price: 5, img: require("./assets/pp1.png"), rating: 5 },
    { name: "Isaac Netero", price: 40, img: require("./assets/pp2.png"), rating: 5 },
    { name: "Ken Kaneki", price: 100, img: require("./assets/pp3.png"), rating: 5 },
    { name: "Izuku Midoriya", price: 20, img: require("./assets/pp4.png"), rating: 5 },
    { name: "Satoru Gojo", price: 200, img: require("./assets/pp5.png"), rating: 5 },
    { name: "Tengen Uzui", price: 140, img: require("./assets/pp6.png"), rating: 5 },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Store</Text>
        <TouchableOpacity>
          <Ionicons name="share-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Only Banner */}
      <Image
        source={require("./assets/storebanner.png")}
        style={styles.bannerImg}
      />

      {/* Welcome Text */}
      <Text style={styles.welcome}>Welcome to my Store! 🤗🛒</Text>

      {/* Items Grid */}
      <View style={styles.itemsGrid}>
        {items.map((item, index) => (
          <View key={index} style={styles.card}>
            <Image source={item.img} style={styles.cardImg} />
            <Text style={styles.cardName}>{item.name}</Text>
            <View style={styles.ratingRow}>
              {Array(item.rating)
                .fill()
                .map((_, i) => (
                  <Ionicons key={i} name="star" size={14} color="#FFD700" />
                ))}
            </View>
            <View style={styles.priceRow}>
              <Image source={require("./assets/goldicon.png")} style={styles.coin} />
              <Text style={styles.price}>{item.price}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Manage Button */}
     <TouchableOpacity
        style={styles.manageBtn}
        onPress={() => navigation.navigate("StoreManagment")}
      >
        <LinearGradient colors={["#E24ECF", "#8A2BE2"]} style={styles.gradientBtn}>
          <Text style={styles.manageText}>Manage</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B10",
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 40,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  bannerImg: {
    width: "100%",
    height: 160,
    borderRadius: 14,
    marginTop: 20,
  },
  welcome: {
    color: "#EAEAF0",
    fontSize: 16,
    marginVertical: 15,
    textAlign: "center",
  },
  itemsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  card: {
    backgroundColor: "#14171C",
    width: "47%",
    borderRadius: 12,
    marginBottom: 14,
    padding: 10,
  },
  cardImg: {
    width: "100%",
    height: 90,
    borderRadius: 8,
  },
  cardName: {
    color: "#fff",
    fontWeight: "600",
    marginTop: 6,
  },
  ratingRow: {
    flexDirection: "row",
    marginVertical: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  coin: {
    width: 16,
    height: 16,
    marginRight: 4,
  },
  price: {
    color: "#FFD54F",
    fontWeight: "600",
  },
  manageBtn: {
    marginTop: 15,
    marginBottom: 40,
  },
  gradientBtn: {
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: "center",
  },
  manageText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
