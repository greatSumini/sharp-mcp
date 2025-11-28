이 프로젝트에 `remove_background` tool을 추가하고싶다.

- input: sessionId, output_path?(string, 절대경로)
- output: output_path가 제공된 경우, 저장 완료 후 해당 경로를 반환. 제공되지 않은 경우 처리 완료된 이미지 base64 payload를 그대로 반환.

이때 배경은 다음과 같이 식별하면 좋을 것 같다. 더 고도화 가능한 방안이 있다면 제안하라.

- 해당 이미지의 side 영역의 색상을 식별하고, 해당 색상과 매우 유사한 색상을 가지며 인접한 영역들을 모두 지우면 된다.

이를 구현하기위한 구체적인 구현 계획 세워달라.

---

sharp mcp를 사용해서 @images/background-before.png 의 배경을 제거한 background-after.png 파일을 같은 경로에 생성하고, before & after 비교를 README 문서에 추가하라.
