import React from 'react';
import styled from 'styled-components/native';
import { Colors } from '../components/styles';
const { tertiary, darkLight } = Colors;

export default function Settings() {
  return (
    <Wrap>
      <Title>Settings</Title>
      <Hint>Theme, voice, and notifications will go here.</Hint>
    </Wrap>
  );
}

const Wrap = styled.View` flex:1; background:#fff; align-items:center; justify-content:center; padding:24px; `;
const Title = styled.Text` font-size:22px; color:${tertiary}; font-weight:800; margin-bottom:8px; `;
const Hint = styled.Text` color:${darkLight}; text-align:center; `;
