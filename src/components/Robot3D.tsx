import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, Stage } from '@react-three/drei';
import * as THREE from 'three';

interface Robot3DProps {
  joints: Record<string, { pos: string }>;
}

const RobotModel = ({ joints }: Robot3DProps) => {
  const parseAngle = (angleStr: string) => {
    const val = parseFloat(angleStr.replace('°', ''));
    return isNaN(val) ? 0 : (val * Math.PI) / 180;
  };

  // Helper to get joint rotation
  const getRot = (name: string) => parseAngle(joints[name]?.pos || '0°');

  // Materials
  const silverMat = <meshPhysicalMaterial color="#e0e0e0" metalness={0.9} roughness={0.1} clearcoat={0.8} clearcoatRoughness={0.1} />;
  const darkMat = <meshPhysicalMaterial color="#121212" metalness={0.8} roughness={0.3} />;
  const glowMat = <meshStandardMaterial color="#00f2ff" emissive="#00f2ff" emissiveIntensity={8} toneMapped={false} />;
  const sensorMat = <meshStandardMaterial color="#000" roughness={0} metalness={1} />;

  return (
    <group position={[0, 0, 0]}>
      {/* Torso / Chest */}
      <mesh position={[0, 1.05, 0]} rotation={[0, getRot('TORSO_YAW'), 0]}>
        <boxGeometry args={[0.36, 0.48, 0.24]} />
        {silverMat}
        
        {/* Chest Sensor Array */}
        <mesh position={[0, 0.1, 0.121]}>
          <boxGeometry args={[0.15, 0.08, 0.01]} />
          {sensorMat}
        </mesh>

        {/* Neck */}
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.12, 24]} />
          {darkMat}
        </mesh>

        {/* Head */}
        <group position={[0, 0.42, 0.02]}>
          {/* Main Head Shape */}
          <mesh>
            <sphereGeometry args={[0.11, 32, 32]} />
            <meshStandardMaterial color="#080808" roughness={0.05} metalness={0.9} />
          </mesh>
          
          {/* Lidar Sensor on Top */}
          <group position={[0, 0.08, 0]}>
             <mesh>
               <cylinderGeometry args={[0.06, 0.06, 0.04, 32]} />
               {darkMat}
             </mesh>
             <mesh position={[0, 0.02, 0]}>
               <cylinderGeometry args={[0.055, 0.055, 0.01, 32]} />
               <meshStandardMaterial color="#000" roughness={0} />
             </mesh>
          </group>

          {/* Visor / Face Plate */}
          <mesh position={[0, 0, 0.08]} rotation={[0.1, 0, 0]}>
            <boxGeometry args={[0.16, 0.12, 0.04]} />
            <meshStandardMaterial color="#000" />
          </mesh>
          
          {/* Camera Array (Front) */}
          <group position={[0, 0.02, 0.1]}>
            <mesh position={[-0.03, 0, 0]}>
              <sphereGeometry args={[0.01, 16, 16]} />
              {sensorMat}
            </mesh>
            <mesh position={[0.03, 0, 0]}>
              <sphereGeometry args={[0.01, 16, 16]} />
              {sensorMat}
            </mesh>
          </group>

          {/* Blue Glow Ring */}
          <mesh position={[0, 0, 0.101]} rotation={[0.1, 0, 0]}>
            <torusGeometry args={[0.06, 0.004, 16, 100]} />
            {glowMat}
          </mesh>
        </group>

        {/* Shoulders & Arms */}
        {/* Left Arm */}
        <group position={[-0.22, 0.18, 0]}>
          {/* Shoulder Actuator Housing */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.12, 24]} />
            {darkMat}
          </mesh>
          {/* Cooling Fins (Simplified) */}
          {[...Array(5)].map((_, i) => (
            <mesh key={i} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.085, 0.002, 8, 32]} />
              {darkMat}
            </mesh>
          ))}

          <group rotation={[getRot('L_SHOULDER_PITCH'), 0, getRot('L_SHOULDER_ROLL')]}>
            {/* Upper Arm */}
            <mesh position={[0, -0.15, 0]}>
              <capsuleGeometry args={[0.055, 0.22, 8, 16]} />
              {silverMat}
            </mesh>
            {/* Elbow Actuator */}
            <group position={[0, -0.32, 0]} rotation={[getRot('L_ELBOW'), 0, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.05, 0.05, 0.1, 24]} />
                {darkMat}
              </mesh>
              {/* Lower Arm */}
              <mesh position={[0, -0.15, 0]}>
                <capsuleGeometry args={[0.045, 0.22, 8, 16]} />
                {silverMat}
              </mesh>
              {/* Wrist / Hand */}
              <group position={[0, -0.32, 0]}>
                <mesh>
                  <sphereGeometry args={[0.04, 16, 16]} />
                  {darkMat}
                </mesh>
                {/* Hand Base */}
                <mesh position={[0, -0.04, 0]}>
                  <boxGeometry args={[0.07, 0.08, 0.04]} />
                  {darkMat}
                </mesh>
                {/* Fingers */}
                <group position={[0, -0.1, 0]}>
                  <mesh position={[-0.02, 0, 0]}>
                    <boxGeometry args={[0.015, 0.06, 0.015]} />
                    {darkMat}
                  </mesh>
                  <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[0.015, 0.06, 0.015]} />
                    {darkMat}
                  </mesh>
                  <mesh position={[0.02, 0, 0]}>
                    <boxGeometry args={[0.015, 0.06, 0.015]} />
                    {darkMat}
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        </group>

        {/* Right Arm */}
        <group position={[0.22, 0.18, 0]}>
          {/* Shoulder Actuator Housing */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.08, 0.12, 24]} />
            {darkMat}
          </mesh>
          <group rotation={[getRot('R_SHOULDER_PITCH'), 0, getRot('R_SHOULDER_ROLL')]}>
            {/* Upper Arm */}
            <mesh position={[0, -0.15, 0]}>
              <capsuleGeometry args={[0.055, 0.22, 8, 16]} />
              {silverMat}
            </mesh>
            {/* Elbow Actuator */}
            <group position={[0, -0.32, 0]} rotation={[getRot('R_ELBOW'), 0, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.05, 0.05, 0.1, 24]} />
                {darkMat}
              </mesh>
              {/* Lower Arm */}
              <mesh position={[0, -0.15, 0]}>
                <capsuleGeometry args={[0.045, 0.22, 8, 16]} />
                {silverMat}
              </mesh>
              {/* Wrist / Hand */}
              <group position={[0, -0.32, 0]}>
                <mesh>
                  <sphereGeometry args={[0.04, 16, 16]} />
                  {darkMat}
                </mesh>
                {/* Hand Base */}
                <mesh position={[0, -0.04, 0]}>
                  <boxGeometry args={[0.07, 0.08, 0.04]} />
                  {darkMat}
                </mesh>
                {/* Fingers */}
                <group position={[0, -0.1, 0]}>
                  <mesh position={[-0.02, 0, 0]}>
                    <boxGeometry args={[0.015, 0.06, 0.015]} />
                    {darkMat}
                  </mesh>
                  <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[0.015, 0.06, 0.015]} />
                    {darkMat}
                  </mesh>
                  <mesh position={[0.02, 0, 0]}>
                    <boxGeometry args={[0.015, 0.06, 0.015]} />
                    {darkMat}
                  </mesh>
                </group>
              </group>
            </group>
          </group>
        </group>
      </mesh>

      {/* Pelvis / Hip Base */}
      <mesh position={[0, 0.76, 0]}>
        <boxGeometry args={[0.32, 0.14, 0.2]} />
        {silverMat}
      </mesh>

      {/* Left Leg */}
      <group position={[-0.12, 0.72, 0]} rotation={[getRot('L_HIP_PITCH'), 0, getRot('L_HIP_ROLL')]}>
        {/* Hip Actuator */}
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.14, 24]} />
          {darkMat}
        </mesh>
        {/* Upper Leg */}
        <mesh position={[0, -0.22, 0]}>
          <capsuleGeometry args={[0.075, 0.32, 8, 16]} />
          {silverMat}
        </mesh>
        {/* Knee Actuator */}
        <group position={[0, -0.44, 0]} rotation={[getRot('L_KNEE'), 0, 0]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.12, 24]} />
            {darkMat}
          </mesh>
          {/* Lower Leg */}
          <mesh position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.06, 0.32, 8, 16]} />
            {silverMat}
          </mesh>
          {/* Ankle Actuator */}
          <group position={[0, -0.44, 0]} rotation={[getRot('L_ANKLE_PITCH'), 0, 0]}>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.1, 24]} />
              {darkMat}
            </mesh>
            {/* Foot */}
            <mesh position={[0, -0.05, 0.05]}>
              <boxGeometry args={[0.11, 0.07, 0.2]} />
              <meshStandardMaterial color="#050505" roughness={0.9} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Right Leg */}
      <group position={[0.12, 0.72, 0]} rotation={[getRot('R_HIP_PITCH'), 0, getRot('R_HIP_ROLL')]}>
        {/* Hip Actuator */}
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.14, 24]} />
          {darkMat}
        </mesh>
        {/* Upper Leg */}
        <mesh position={[0, -0.22, 0]}>
          <capsuleGeometry args={[0.075, 0.32, 8, 16]} />
          {silverMat}
        </mesh>
        {/* Knee Actuator */}
        <group position={[0, -0.44, 0]} rotation={[getRot('R_KNEE'), 0, 0]}>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.12, 24]} />
            {darkMat}
          </mesh>
          {/* Lower Leg */}
          <mesh position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.06, 0.32, 8, 16]} />
            {silverMat}
          </mesh>
          {/* Ankle Actuator */}
          <group position={[0, -0.44, 0]} rotation={[getRot('R_ANKLE_PITCH'), 0, 0]}>
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.1, 24]} />
              {darkMat}
            </mesh>
            {/* Foot */}
            <mesh position={[0, -0.05, 0.05]}>
              <boxGeometry args={[0.11, 0.07, 0.2]} />
              <meshStandardMaterial color="#050505" roughness={0.9} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};

export const Robot3D = ({ joints }: Robot3DProps) => {
  return (
    <div className="w-full h-full bg-[#050505]">
      <Canvas 
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [2, 2, 4], fov: 45 }}
        gl={{ 
          antialias: true,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
          depth: true
        }}
      >
        <color attach="background" args={['#050505']} />
        <Stage intensity={0.5} environment="city" adjustCamera={false}>
          <RobotModel joints={joints} />
        </Stage>
        <Grid 
          infiniteGrid 
          fadeDistance={20} 
          fadeStrength={5} 
          cellSize={0.5} 
          sectionSize={2} 
          sectionColor="#10b981" 
          cellColor="#111" 
        />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};
