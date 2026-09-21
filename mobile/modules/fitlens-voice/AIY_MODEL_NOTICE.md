# Google AIY Food V1

Copyright Google. Distributed under Apache License 2.0; see AIY_MODEL_LICENSE.txt.

Model: https://www.kaggle.com/models/google/aiy/tfLite/vision-classifier-food-v1/1
Labels: https://www.gstatic.com/aihub/tfhub/labelmaps/aiy_food_V1_labelmap.csv
Downloaded 2026-09-21. Original weights are unmodified. CSV labels converted to a JSON string array, preserving order.

The downloaded mobile model has uint8 input [1,192,192,3], quantization scale 1/128 and zero point 128; raw RGB bytes represent the normalized input. Output is uint8 [1,2024], scale 1/256, zero point 0. This differs from the generic TensorFlow model card's float 224px input. Always inspect actual model tensors.

Recognizes one cropped dish from a fixed vocabulary, with North American training bias. Scores are not calibrated confidence. Does not identify every dish, ingredients, portion sizes, allergens or calories. Dosa is absent from the supplied label map; sambar and idli are present.
