import React from "react";
import { Text, TextInput, View } from "react-native";

interface Props {
  countryCode?: string;        // e.g. "+237"
  phone: string;
  onChangePhone: (text: string) => void;
}

export default function CountryPhoneInput({
  countryCode = "+237",
  phone,
  onChangePhone,
}: Props) {
  return (
    <View style={{ width: "100%", marginTop: 20 }}>
      <Text style={{ fontSize: 14, marginBottom: 6, color: "#333" }}>
        Phone Number
      </Text>

      <View
        style={{
          flexDirection: "row",
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          alignItems: "center",
          paddingHorizontal: 10,
          height: 50,
        }}
      >
        <Text style={{ fontSize: 16, marginRight: 8 }}>{countryCode}</Text>

        <TextInput
          style={{
            flex: 1,
            fontSize: 16,
            height: "100%",
          }}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={onChangePhone}
        />
      </View>
    </View>
  );
}
