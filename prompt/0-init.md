다음 요구사항을 이 코드베이스에 반영하기위한 구체적인 구현 계획 세워주세요.

1. 패키지명을 `image-handler-mcp`로 바꾸고, 버전은 0.0.0으로 바꾼다.
2. 기존 tool들은 제거하고 다음 tool을 추가한다.

   - create_session
     - input: image_payload(base64 string), description?(string)
     - output: 입력된 {image*payload: string, description?: string}를 Map 객체의 value로 저장하고, key(sessionId)를 nanoid string으로 설정하고 반환한다. key는 반드시 `img*${nanoid()}` 형식이다.
   - list_session
     - input: none
     - output: {image_payload: string, description?: string}[]
   - get_image_size
     - input: sessionId(string)
     - output: {width: number, height: number, mimeType: string}
   - pick_color
     - input: sessionId(string), x(number), y(number), radius?(number, default:5)
     - output: 입력된 이미지에 대해 해당 지점을 중심으로 radius \* 2 크기의 사각형 영역의 평균 색상을 추출한다. x, y가 이미지 크기를 초과하는 경우 적절한 에러 메세지를 반환한다.

공용 로직:

- input parameter로 입력된 sessionId의 형식이 맞지않거나 존재하지 않는 값인 경우, 적절한 에러메세지와 함께 `create_session`을 먼저 호출하라는 문구를 반환한다.
