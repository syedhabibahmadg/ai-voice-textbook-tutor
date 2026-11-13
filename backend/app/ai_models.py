from .providers import groq_models
if __name__ == '__main__':
    for model in groq_models():
        print(model)
